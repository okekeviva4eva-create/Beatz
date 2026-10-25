import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Save,
  FolderOpen,
  Trash2,
  LogIn,
  LogOut,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  ArpMode,
  KnobParameters,
  PROGRAM_PRESETS,
  ProgramPreset,
  SwingAmount,
  TimeDivision,
} from '../audio/soundEngine';

export interface CloudSynthPatch {
  id: string;
  ownerId: string;
  authorName: string;
  name: string;
  programId: number;
  bpm: number;
  timeDivision: TimeDivision;
  arpMode: ArpMode;
  arpOctaves: 1 | 2 | 3 | 4;
  swing: SwingAmount;
  k1Cutoff: number;
  k2Resonance: number;
  k3Attack: number;
  k4Release: number;
  k5Detune: number;
  k6SubMix: number;
  k7DelayMix: number;
  k8ReverbMix: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

interface CloudPatchBankProps {
  program: ProgramPreset;
  knobs: KnobParameters;
  bpm: number;
  timeDivision: TimeDivision;
  arpMode: ArpMode;
  arpOctaves: 1 | 2 | 3 | 4;
  swing: SwingAmount;
  onLoadPatch: (patch: CloudSynthPatch) => void;
  onStatusUpdate: (status: string) => void;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_NAME_LENGTH = 80;

export const CloudPatchBank: React.FC<CloudPatchBankProps> = ({
  program,
  knobs,
  bpm,
  timeDivision,
  arpMode,
  arpOctaves,
  swing,
  onLoadPatch,
  onStatusUpdate,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [patches, setPatches] = useState<CloudSynthPatch[]>([]);
  const [patchName, setPatchName] = useState<string>('');
  const [activePatchId, setActivePatchId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setPatches([]);
      return;
    }

    const patchesPath = 'patches';
    const q = query(
      collection(db, patchesPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CloudSynthPatch[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: String(data.ownerId || ''),
            authorName: String(data.authorName || 'Producer'),
            name: String(data.name || 'Untitled Patch'),
            programId: Number(data.programId || 1),
            bpm: Number(data.bpm || 112),
            timeDivision: (data.timeDivision as TimeDivision) || '1/16',
            arpMode: (data.arpMode as ArpMode) || 'UP',
            arpOctaves: (Number(data.arpOctaves || 1) as 1 | 2 | 3 | 4),
            swing: (Number(data.swing || 50) as SwingAmount),
            k1Cutoff: Number(data.k1Cutoff ?? 90),
            k2Resonance: Number(data.k2Resonance ?? 24),
            k3Attack: Number(data.k3Attack ?? 10),
            k4Release: Number(data.k4Release ?? 48),
            k5Detune: Number(data.k5Detune ?? 24),
            k6SubMix: Number(data.k6SubMix ?? 55),
            k7DelayMix: Number(data.k7DelayMix ?? 28),
            k8ReverbMix: Number(data.k8ReverbMix ?? 35),
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
          };
        });

        // Sort most recently updated first
        list.sort((a, b) => {
          const tA = a.updatedAt?.toMillis?.() ?? 0;
          const tB = b.updatedAt?.toMillis?.() ?? 0;
          return tB - tA;
        });

        setPatches(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, patchesPath);
        } catch (err) {
          setErrorBanner(
            err instanceof Error ? 'Unable to load saved patches.' : 'Error loading patches.'
          );
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  const handleSignIn = async () => {
    setErrorBanner(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      onStatusUpdate('SIGNED IN · CLOUD PATCH BANK READY');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Sign-in cancelled.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActivePatchId(null);
    onStatusUpdate('SIGNED OUT');
  };

  const clampKnob = (val: number) => Math.max(0, Math.min(127, Math.round(val)));

  const handleSaveNewPatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSaving) return;

    const cleanName = (patchName.trim() || `${program.name} (${bpm} BPM)`).slice(
      0,
      MAX_NAME_LENGTH
    );
    const cleanAuthor = (user.displayName || user.email?.split('@')[0] || 'Producer')
      .trim()
      .slice(0, MAX_NAME_LENGTH);

    const patchId = `patch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!VALID_ID_REGEX.test(patchId)) return;

    setIsSaving(true);
    setErrorBanner(null);
    const path = `patches/${patchId}`;

    try {
      await setDoc(doc(db, 'patches', patchId), {
        ownerId: user.uid,
        authorName: cleanAuthor,
        name: cleanName,
        programId: Math.max(1, Math.min(4, Math.round(program.id))),
        bpm: Math.max(40, Math.min(220, Math.round(bpm))),
        timeDivision,
        arpMode,
        arpOctaves,
        swing,
        k1Cutoff: clampKnob(knobs.k1Cutoff),
        k2Resonance: clampKnob(knobs.k2Resonance),
        k3Attack: clampKnob(knobs.k3Attack),
        k4Release: clampKnob(knobs.k4Release),
        k5Detune: clampKnob(knobs.k5Detune),
        k6SubMix: clampKnob(knobs.k6SubMix),
        k7DelayMix: clampKnob(knobs.k7DelayMix),
        k8ReverbMix: clampKnob(knobs.k8ReverbMix),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setActivePatchId(patchId);
      setPatchName('');
      setSavedToast(`Saved "${cleanName}"`);
      onStatusUpdate(`PATCH SAVED: ${cleanName.toUpperCase()}`);
      setTimeout(() => setSavedToast(null), 3000);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, path);
      } catch {
        setErrorBanner('Could not save patch. Ensure your account email is verified.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePatch = async (patch: CloudSynthPatch) => {
    if (!user || isSaving) return;
    if (!VALID_ID_REGEX.test(patch.id)) return;

    setIsSaving(true);
    setErrorBanner(null);
    const path = `patches/${patch.id}`;
    const cleanAuthor = (user.displayName || patch.authorName || 'Producer')
      .trim()
      .slice(0, MAX_NAME_LENGTH);

    try {
      await updateDoc(doc(db, 'patches', patch.id), {
        authorName: cleanAuthor,
        name: (patchName.trim() || patch.name).slice(0, MAX_NAME_LENGTH),
        programId: Math.max(1, Math.min(4, Math.round(program.id))),
        bpm: Math.max(40, Math.min(220, Math.round(bpm))),
        timeDivision,
        arpMode,
        arpOctaves,
        swing,
        k1Cutoff: clampKnob(knobs.k1Cutoff),
        k2Resonance: clampKnob(knobs.k2Resonance),
        k3Attack: clampKnob(knobs.k3Attack),
        k4Release: clampKnob(knobs.k4Release),
        k5Detune: clampKnob(knobs.k5Detune),
        k6SubMix: clampKnob(knobs.k6SubMix),
        k7DelayMix: clampKnob(knobs.k7DelayMix),
        k8ReverbMix: clampKnob(knobs.k8ReverbMix),
        updatedAt: serverTimestamp(),
      });

      setSavedToast(`Updated "${patch.name}"`);
      onStatusUpdate(`PATCH UPDATED: ${patch.name.toUpperCase()}`);
      setTimeout(() => setSavedToast(null), 3000);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } catch {
        setErrorBanner('Could not update patch.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePatch = async (patchId: string, name: string) => {
    if (!user) return;
    const path = `patches/${patchId}`;
    try {
      await deleteDoc(doc(db, 'patches', patchId));
      if (activePatchId === patchId) {
        setActivePatchId(null);
      }
      onStatusUpdate(`PATCH DELETED: ${name.toUpperCase()}`);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, path);
      } catch {
        setErrorBanner('Could not delete patch.');
      }
    }
  };

  return (
    <section className="w-full bg-[#16181d] border border-zinc-800/90 rounded-xl p-5 shadow-xl flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600/15 border border-red-500/40 flex items-center justify-center text-red-400">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-white tracking-tight">
              MPK mini User Patch &amp; Knob Bank Library
            </h2>
            <p className="text-xs text-zinc-400">
              Save and recall custom hardware programs, K1–K8 filter/envelope settings, and arpeggiator clock grooves.
            </p>
          </div>
        </div>

        {/* Auth Controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-300 font-medium">
                {user.displayName || user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Save Patches</span>
            </button>
          )}
        </div>
      </div>

      {errorBanner && (
        <div className="bg-red-950/50 border border-red-800/80 rounded-lg px-4 py-2 text-xs text-red-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-red-300 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {savedToast && (
        <div className="bg-emerald-950/50 border border-emerald-700/70 rounded-lg px-4 py-2 text-xs text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {user ? (
        <div className="flex flex-col gap-4">
          {/* Save Current Hardware State Form */}
          <form onSubmit={handleSaveNewPatch} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              maxLength={MAX_NAME_LENGTH}
              value={patchName}
              onChange={(e) => setPatchName(e.target.value)}
              placeholder={`Name current patch (e.g., Late Night ${program.name})...`}
              className="flex-1 bg-[#0d0f13] border border-zinc-800 focus:border-red-500 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Current Hardware Patch</span>
            </button>
          </form>

          {/* Saved Patches Grid */}
          {patches.length === 0 ? (
            <div className="bg-[#0f1116] border border-zinc-800/80 rounded-lg p-4 text-center text-xs text-zinc-400">
              No saved hardware patches yet. Dial in your K1–K8 knobs and arpeggiator settings above, then click <strong>Save Current Hardware Patch</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {patches.map((p) => {
                const isSelected = activePatchId === p.id;
                const presetObj = PROGRAM_PRESETS.find((pr) => pr.id === p.programId) || PROGRAM_PRESETS[0];
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-[#1b1417] border-red-500/70'
                        : 'bg-[#0f1116] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-zinc-400">
                        <span>PROG {p.programId} · {presetObj.category}</span>
                        <span>{p.bpm} BPM · {p.timeDivision}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-0.5 truncate" title={p.name}>
                        {p.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 mt-1 font-mono-tabular">
                        <span>Cut {p.k1Cutoff}</span>
                        <span aria-hidden="true">·</span>
                        <span>Res {p.k2Resonance}</span>
                        <span aria-hidden="true">·</span>
                        <span>Dly {p.k7DelayMix}</span>
                        <span aria-hidden="true">·</span>
                        <span>Rev {p.k8ReverbMix}</span>
                        <span aria-hidden="true">·</span>
                        <span>Arp {p.arpMode}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePatchId(p.id);
                          onLoadPatch(p);
                        }}
                        className="px-3 py-1 rounded bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Load Patch
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdatePatch(p)}
                          title="Overwrite this patch with current MPK mini knob settings"
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Overwrite</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePatch(p.id, p.name)}
                          title="Delete patch"
                          className="p-1.5 rounded bg-zinc-800/80 hover:bg-red-900/60 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#0f1116] border border-zinc-800/80 rounded-lg p-4 flex items-center justify-between gap-4 text-xs text-zinc-400">
          <span>
            Sign in with your Google account to save custom AKAI MPK mini patches, knob presets, and arpeggiator grooves across sessions.
          </span>
        </div>
      )}
    </section>
  );
};
