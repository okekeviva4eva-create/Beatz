import React, { useEffect, useRef, useState } from 'react';
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
  HardDrive,
  Download,
  Upload,
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
import { useOnlineStatus } from './PWAOfflineControls';

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
  updatedAtMs?: number;
  isLocalOnly?: boolean;
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
const LOCAL_PATCHES_STORAGE_KEY = 'mpk_studio_local_patches_v1';

const DEFAULT_OFFLINE_PATCHES: CloudSynthPatch[] = [
  {
    id: 'local_boombap_warm_sub',
    ownerId: 'local_device',
    authorName: 'Offline Factory',
    name: 'Late Night Boom-Bap Warm Poly',
    programId: 1,
    bpm: 94,
    timeDivision: '1/16',
    arpMode: 'UP',
    arpOctaves: 1,
    swing: 57,
    k1Cutoff: 88,
    k2Resonance: 32,
    k3Attack: 10,
    k4Release: 54,
    k5Detune: 30,
    k6SubMix: 68,
    k7DelayMix: 34,
    k8ReverbMix: 40,
    updatedAtMs: 1700000003000,
    isLocalOnly: true,
  },
  {
    id: 'local_acid_warehouse_303',
    ownerId: 'local_device',
    authorName: 'Offline Factory',
    name: 'Warehouse Acid 303 Squelch',
    programId: 3,
    bpm: 124,
    timeDivision: '1/16',
    arpMode: 'INCL',
    arpOctaves: 2,
    swing: 55,
    k1Cutoff: 72,
    k2Resonance: 96,
    k3Attack: 4,
    k4Release: 28,
    k5Detune: 18,
    k6SubMix: 78,
    k7DelayMix: 48,
    k8ReverbMix: 26,
    updatedAtMs: 1700000002000,
    isLocalOnly: true,
  },
  {
    id: 'local_synthwave_dream_arp',
    ownerId: 'local_device',
    authorName: 'Offline Factory',
    name: '1984 Analog Synthwave Chorus',
    programId: 4,
    bpm: 114,
    timeDivision: '1/16',
    arpMode: 'UP',
    arpOctaves: 2,
    swing: 50,
    k1Cutoff: 106,
    k2Resonance: 38,
    k3Attack: 12,
    k4Release: 76,
    k5Detune: 52,
    k6SubMix: 64,
    k7DelayMix: 56,
    k8ReverbMix: 70,
    updatedAtMs: 1700000001000,
    isLocalOnly: true,
  },
];

function loadLocalPatches(): CloudSynthPatch[] {
  try {
    const raw = localStorage.getItem(LOCAL_PATCHES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_PATCHES_STORAGE_KEY, JSON.stringify(DEFAULT_OFFLINE_PATCHES));
      return DEFAULT_OFFLINE_PATCHES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fallback if localStorage is unavailable
  }
  return DEFAULT_OFFLINE_PATCHES;
}

function saveLocalPatches(patches: CloudSynthPatch[]) {
  try {
    localStorage.setItem(LOCAL_PATCHES_STORAGE_KEY, JSON.stringify(patches));
  } catch {
    // Ignore quota errors
  }
}

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
  const isOnline = useOnlineStatus();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [localPatches, setLocalPatches] = useState<CloudSynthPatch[]>(() => loadLocalPatches());
  const [cloudPatches, setCloudPatches] = useState<CloudSynthPatch[]>([]);
  const [patchName, setPatchName] = useState<string>('');
  const [activePatchId, setActivePatchId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setCloudPatches([]);
      return;
    }

    const patchesPath = 'patches';
    const q = query(collection(db, patchesPath), where('ownerId', '==', user.uid));

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
            arpOctaves: Number(data.arpOctaves || 1) as 1 | 2 | 3 | 4,
            swing: Number(data.swing || 50) as SwingAmount,
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
            updatedAtMs: data.updatedAt?.toMillis?.() ?? Date.now(),
            isLocalOnly: false,
          };
        });

        list.sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0));
        setCloudPatches(list);
      },
      (error) => {
        if (!navigator.onLine) return;
        try {
          handleFirestoreError(error, OperationType.LIST, patchesPath);
        } catch {
          // Keep offline patches active without blocking the user
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  // Combine cloud patches and local device patches (avoiding duplicate IDs)
  const combinedPatches = React.useMemo(() => {
    const cloudIds = new Set(cloudPatches.map((p) => p.id));
    const merged = [
      ...cloudPatches,
      ...localPatches.filter((lp) => !cloudIds.has(lp.id)),
    ];
    return merged.sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0));
  }, [cloudPatches, localPatches]);

  const handleSignIn = async () => {
    if (!isOnline) {
      setErrorBanner('You are currently offline. Patches are being saved directly to your device.');
      return;
    }
    setErrorBanner(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      onStatusUpdate('SIGNED IN · CLOUD + OFFLINE PATCH BANK READY');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Sign-in cancelled.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActivePatchId(null);
    onStatusUpdate('SIGNED OUT · LOCAL OFFLINE PATCHES ACTIVE');
  };

  const clampKnob = (val: number) => Math.max(0, Math.min(127, Math.round(val)));

  const handleSaveNewPatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const cleanName = (patchName.trim() || `${program.name} (${bpm} BPM)`).slice(
      0,
      MAX_NAME_LENGTH
    );
    const cleanAuthor = (
      user?.displayName ||
      user?.email?.split('@')[0] ||
      'Offline Producer'
    )
      .trim()
      .slice(0, MAX_NAME_LENGTH);

    const patchId = `patch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (!VALID_ID_REGEX.test(patchId)) return;

    setIsSaving(true);
    setErrorBanner(null);

    const newPatchObj: CloudSynthPatch = {
      id: patchId,
      ownerId: user?.uid || 'local_device',
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
      updatedAtMs: Date.now(),
      isLocalOnly: !user || !isOnline,
    };

    // 1. Always save immediately to local storage so it works 100% offline
    setLocalPatches((prev) => {
      const next = [newPatchObj, ...prev];
      saveLocalPatches(next);
      return next;
    });

    // 2. If signed in and online, also sync to Firestore
    if (user && isOnline) {
      const path = `patches/${patchId}`;
      try {
        await setDoc(doc(db, 'patches', patchId), {
          ownerId: user.uid,
          authorName: cleanAuthor,
          name: cleanName,
          programId: newPatchObj.programId,
          bpm: newPatchObj.bpm,
          timeDivision,
          arpMode,
          arpOctaves,
          swing,
          k1Cutoff: newPatchObj.k1Cutoff,
          k2Resonance: newPatchObj.k2Resonance,
          k3Attack: newPatchObj.k3Attack,
          k4Release: newPatchObj.k4Release,
          k5Detune: newPatchObj.k5Detune,
          k6SubMix: newPatchObj.k6SubMix,
          k7DelayMix: newPatchObj.k7DelayMix,
          k8ReverbMix: newPatchObj.k8ReverbMix,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.CREATE, path);
        } catch {
          // Saved locally already
        }
      }
    }

    setActivePatchId(patchId);
    setPatchName('');
    setSavedToast(
      user && isOnline
        ? `Saved "${cleanName}" (Cloud + Offline)`
        : `Saved "${cleanName}" to Offline Device Storage`
    );
    onStatusUpdate(`PATCH SAVED: ${cleanName.toUpperCase()}`);
    setTimeout(() => setSavedToast(null), 3000);
    setIsSaving(false);
  };

  const handleUpdatePatch = async (patch: CloudSynthPatch) => {
    if (isSaving) return;
    if (!VALID_ID_REGEX.test(patch.id)) return;

    setIsSaving(true);
    setErrorBanner(null);

    const updatedName = (patchName.trim() || patch.name).slice(0, MAX_NAME_LENGTH);
    const updatedObj: CloudSynthPatch = {
      ...patch,
      name: updatedName,
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
      updatedAtMs: Date.now(),
    };

    // Update in local storage
    setLocalPatches((prev) => {
      const exists = prev.some((p) => p.id === patch.id);
      const next = exists
        ? prev.map((p) => (p.id === patch.id ? updatedObj : p))
        : [updatedObj, ...prev];
      saveLocalPatches(next);
      return next;
    });

    // If cloud patch and signed in online, update Firestore
    if (user && isOnline && !patch.isLocalOnly && patch.ownerId === user.uid) {
      const path = `patches/${patch.id}`;
      const cleanAuthor = (user.displayName || patch.authorName || 'Producer')
        .trim()
        .slice(0, MAX_NAME_LENGTH);
      try {
        await updateDoc(doc(db, 'patches', patch.id), {
          authorName: cleanAuthor,
          name: updatedName,
          programId: updatedObj.programId,
          bpm: updatedObj.bpm,
          timeDivision,
          arpMode,
          arpOctaves,
          swing,
          k1Cutoff: updatedObj.k1Cutoff,
          k2Resonance: updatedObj.k2Resonance,
          k3Attack: updatedObj.k3Attack,
          k4Release: updatedObj.k4Release,
          k5Detune: updatedObj.k5Detune,
          k6SubMix: updatedObj.k6SubMix,
          k7DelayMix: updatedObj.k7DelayMix,
          k8ReverbMix: updatedObj.k8ReverbMix,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, path);
        } catch {
          // Local update already succeeded
        }
      }
    }

    setSavedToast(`Updated "${updatedName}"`);
    onStatusUpdate(`PATCH UPDATED: ${updatedName.toUpperCase()}`);
    setTimeout(() => setSavedToast(null), 3000);
    setIsSaving(false);
  };

  const handleDeletePatch = async (patch: CloudSynthPatch) => {
    setLocalPatches((prev) => {
      const next = prev.filter((p) => p.id !== patch.id);
      saveLocalPatches(next);
      return next;
    });

    if (user && isOnline && !patch.isLocalOnly && patch.ownerId === user.uid) {
      const path = `patches/${patch.id}`;
      try {
        await deleteDoc(doc(db, 'patches', patch.id));
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.DELETE, path);
        } catch {
          // Ignore if already removed locally
        }
      }
    }

    if (activePatchId === patch.id) {
      setActivePatchId(null);
    }
    onStatusUpdate(`PATCH DELETED: ${patch.name.toUpperCase()}`);
  };

  const handleExportPatchesJson = () => {
    const dataStr = JSON.stringify(combinedPatches, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `akai-mpk-mini-patches-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onStatusUpdate(`EXPORTED ${combinedPatches.length} PATCHES (.JSON)`);
  };

  const handleImportPatchesJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validImported: CloudSynthPatch[] = parsed
            .filter((item) => item && typeof item.name === 'string')
            .map((item, idx) => ({
              id:
                typeof item.id === 'string' && VALID_ID_REGEX.test(item.id)
                  ? item.id
                  : `imported_${Date.now()}_${idx}`,
              ownerId: 'local_device',
              authorName: String(item.authorName || 'Imported'),
              name: String(item.name).slice(0, MAX_NAME_LENGTH),
              programId: Math.max(1, Math.min(4, Number(item.programId || 1))),
              bpm: Math.max(40, Math.min(220, Number(item.bpm || 112))),
              timeDivision: (item.timeDivision as TimeDivision) || '1/16',
              arpMode: (item.arpMode as ArpMode) || 'UP',
              arpOctaves: (Number(item.arpOctaves || 1) as 1 | 2 | 3 | 4),
              swing: (Number(item.swing || 50) as SwingAmount),
              k1Cutoff: clampKnob(Number(item.k1Cutoff ?? 90)),
              k2Resonance: clampKnob(Number(item.k2Resonance ?? 24)),
              k3Attack: clampKnob(Number(item.k3Attack ?? 10)),
              k4Release: clampKnob(Number(item.k4Release ?? 48)),
              k5Detune: clampKnob(Number(item.k5Detune ?? 24)),
              k6SubMix: clampKnob(Number(item.k6SubMix ?? 55)),
              k7DelayMix: clampKnob(Number(item.k7DelayMix ?? 28)),
              k8ReverbMix: clampKnob(Number(item.k8ReverbMix ?? 35)),
              updatedAtMs: Date.now() + idx,
              isLocalOnly: true,
            }));

          setLocalPatches((prev) => {
            const existingIds = new Set(validImported.map((v) => v.id));
            const merged = [...validImported, ...prev.filter((p) => !existingIds.has(p.id))];
            saveLocalPatches(merged);
            return merged;
          });
          setSavedToast(`Imported ${validImported.length} patches into Offline Bank`);
          onStatusUpdate(`IMPORTED ${validImported.length} PATCHES`);
          setTimeout(() => setSavedToast(null), 3000);
        }
      } catch {
        setErrorBanner('Invalid patch bank JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <section className="w-full bg-[#16181d] border border-zinc-800/90 rounded-xl p-5 shadow-xl flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600/15 border border-red-500/40 flex items-center justify-center text-red-400">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold text-white tracking-tight">
                MPK mini User Patch &amp; Knob Bank Library
              </h2>
              <span className="text-[10px] font-mono-tabular font-semibold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                Offline Storage Active
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Save and recall custom hardware programs, K1–K8 filter/envelope settings, and arpeggiator grooves offline on your device or synced to the cloud.
            </p>
          </div>
        </div>

        {/* Offline Backup Export/Import + Optional Cloud Auth Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPatchesJson}
            data-hw-title="EXPORT PATCH BANK (.JSON)"
            data-hw-func="Downloads all saved patches as a portable .json file for offline backup."
            data-hw-state={`${combinedPatches.length} PATCHES`}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-red-400" />
            <span>Export .JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-hw-title="IMPORT PATCH BANK (.JSON)"
            data-hw-func="Loads a previously exported .json patch bank file directly into your offline patch library."
            data-hw-state="OFFLINE IMPORT"
            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import .JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportPatchesJson}
            className="hidden"
          />

          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-300 font-medium hidden sm:inline">
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
            isOnline && (
              <button
                type="button"
                onClick={handleSignIn}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5 text-red-400" />
                <span>Cloud Sync Sign-In</span>
              </button>
            )
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

      <div className="flex flex-col gap-4">
        {/* Save Current Hardware State Form (Always available offline & online) */}
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
        {combinedPatches.length === 0 ? (
          <div className="bg-[#0f1116] border border-zinc-800/80 rounded-lg p-4 text-center text-xs text-zinc-400">
            No saved hardware patches yet. Dial in your K1–K8 knobs and arpeggiator settings above, then click <strong>Save Current Hardware Patch</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {combinedPatches.map((p) => {
              const isSelected = activePatchId === p.id;
              const presetObj =
                PROGRAM_PRESETS.find((pr) => pr.id === p.programId) || PROGRAM_PRESETS[0];
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
                      <span>
                        PROG {p.programId} · {presetObj.category}
                      </span>
                      <span>
                        {p.bpm} BPM · {p.timeDivision}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <h3 className="text-sm font-bold text-white truncate" title={p.name}>
                        {p.name}
                      </h3>
                      <span className="text-[9px] font-mono-tabular px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-400 shrink-0">
                        {p.isLocalOnly ? 'LOCAL' : 'CLOUD'}
                      </span>
                    </div>
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
                        onClick={() => handleDeletePatch(p)}
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
    </section>
  );
};
