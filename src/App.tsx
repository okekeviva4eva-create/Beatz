import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, Keyboard, Play, Square, Sliders } from 'lucide-react';
import {
  ArpMode,
  KEYBOARD_VOICE_OPTIONS,
  KeyboardVoiceMode,
  KnobParameters,
  PROGRAM_PRESETS,
  ProgramPreset,
  soundEngine,
  SwingAmount,
  TimeDivision,
} from './audio/soundEngine';
import { exportLoopToMidiFile } from './audio/midiExporter';
import {
  HardwareHoverCallout,
  HoveredControlInfo,
  RedThumbstick,
  RotaryKnob,
  StudioOscilloscope,
} from './components/HardwareControls';
import { KEYBED_25, Keybed25, KeyDefinition } from './components/Keybed25';
import {
  createEmptyGrid,
  createPresetGridForProgram,
  StepGridState,
  StepSequencer16,
} from './components/StepSequencer16';
import { CloudPatchBank, CloudSynthPatch } from './components/CloudPatchBank';
import { BeatStudioRecorder, BeatRecordedEvent } from './components/BeatStudioRecorder';
import {
  computePadVelocity,
  DEFAULT_PAD_VELOCITY_CONFIG,
  LastPadHitTelemetry,
  PadVelocityConfig,
  PadVelocitySettingsPanel,
} from './components/PadVelocitySettingsPanel';
import { OfflineBanner, PWAInstallButton } from './components/PWAOfflineControls';

type RecordedEvent = BeatRecordedEvent;

const OFFLINE_SESSION_STORAGE_KEY = 'mpk_studio_offline_session_v2';

const TIME_DIV_STEPS_PER_BEAT: Record<TimeDivision, number> = {
  '1/4': 1,
  '1/4T': 1.5,
  '1/8': 2,
  '1/8T': 3,
  '1/16': 4,
  '1/16T': 6,
  '1/32': 8,
  '1/32T': 12,
};

const SIXTEENTH_NOTE_BEATS = 0.25; // 1/16th note = 0.25 quarter-note beats
const LOOP_LENGTH_BEATS = 8;       // 2 bars of 4/4 = 8 beats (32 sixteenth-note steps)

// Default 2-bar (32-step) rhythmic groove patterns when a user clicks an MPC Pad to loop it
const PAD_LOOP_PATTERNS_32: Record<number, number[]> = {
  0: [0, 6, 8, 14, 16, 22, 24, 30], // Pad 1: Kick groove
  1: [4, 12, 20, 28],               // Pad 2: Snare backbeat
  2: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], // Pad 3: Steady 8th Hats
  3: [2, 10, 18, 26],               // Pad 4: Upbeat Open Hats
  4: [4, 11, 12, 20, 27, 28],       // Pad 5: Syncopated Clap / Perc
  5: [3, 7, 15, 19, 23, 31],        // Pad 6: Rimshot / Cowbell accents
  6: [0, 3, 8, 11, 16, 19, 24, 27], // Pad 7: Sub / Bass Pad drop groove
  7: [0, 6, 12, 16, 22, 28],        // Pad 8: Rhodes / Chord Stabs
};

function quantizeEventsToSixteenthGrid(events: RecordedEvent[]): RecordedEvent[] {
  return events.map((ev) => {
    const snappedOffset =
      ((Math.round(ev.beatOffset / SIXTEENTH_NOTE_BEATS) * SIXTEENTH_NOTE_BEATS) %
        LOOP_LENGTH_BEATS +
        LOOP_LENGTH_BEATS) %
      LOOP_LENGTH_BEATS;

    const rawDuration = ev.durationBeats ?? (ev.type === 'pad' ? 0.25 : 0.5);
    const snappedDuration = Math.max(
      SIXTEENTH_NOTE_BEATS,
      Math.round(rawDuration / SIXTEENTH_NOTE_BEATS) * SIXTEENTH_NOTE_BEATS
    );

    return {
      ...ev,
      beatOffset: Number(snappedOffset.toFixed(4)),
      durationBeats: Number(snappedDuration.toFixed(4)),
    };
  });
}

export default function App() {
  // Core Hardware State
  const [program, setProgram] = useState<ProgramPreset>(PROGRAM_PRESETS[0]);
  const [keyboardVoice, setKeyboardVoice] = useState<KeyboardVoiceMode>('synth');
  const [knobs, setKnobs] = useState<KnobParameters>({ ...PROGRAM_PRESETS[0].defaultKnobs });
  const [octaveShift, setOctaveShift] = useState<number>(0); // -3..+3
  const [padBank, setPadBank] = useState<'A' | 'B'>('A');
  const [padCCMode, setPadCCMode] = useState<boolean>(false);
  const [padProgChangeMode, setPadProgChangeMode] = useState<boolean>(false);
  const [progSelectActive, setProgSelectActive] = useState<boolean>(false);

  // Performance Modes
  const [arpOn, setArpOn] = useState<boolean>(false);
  const [arpConfigHold, setArpConfigHold] = useState<boolean>(false);
  const [fullLevel, setFullLevel] = useState<boolean>(false);
  const [noteRepeat, setNoteRepeat] = useState<boolean>(false);

  // Arpeggiator & Clock Parameters
  const [bpm, setBpm] = useState<number>(112);
  const [timeDivision, setTimeDivision] = useState<TimeDivision>('1/16');
  const [arpMode, setArpMode] = useState<ArpMode>('UP');
  const [arpLatch, setArpLatch] = useState<boolean>(false);
  const [arpOctaves, setArpOctaves] = useState<1 | 2 | 3 | 4>(1);
  const [swing, setSwing] = useState<SwingAmount>(50);

  // Thumbstick X/Y
  const [pitchBend, setPitchBend] = useState<number>(0);
  const [modWheel, setModWheel] = useState<number>(0);

  // Active Pressed Keys & Pads
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [latchedNotes, setLatchedNotes] = useState<number[]>([]);
  const [activePads, setActivePads] = useState<Set<number>>(new Set());

  // Studio Rack UI Helpers
  const [showKeyShortcuts, setShowKeyShortcuts] = useState<boolean>(true);
  const [masterVol, setMasterVol] = useState<number>(0.85);
  const [lcdStatus, setLcdStatus] = useState<string>('READY · BANK A · 112 BPM');
  const [beatPulse, setBeatPulse] = useState<boolean>(false);
  const [hoveredControl, setHoveredControl] = useState<HoveredControlInfo | null>(null);

  // MPC Pad Velocity Curve & Sensitivity Settings
  const [padVelocityConfig, setPadVelocityConfig] = useState<PadVelocityConfig>(
    DEFAULT_PAD_VELOCITY_CONFIG
  );
  const [showPadVelocityPanel, setShowPadVelocityPanel] = useState<boolean>(true);
  const [lastPadHit, setLastPadHit] = useState<LastPadHitTelemetry | null>(null);

  // Demo Groove, 16-Step Drum Grid & Loop Recorder State
  const [demoPlaying, setDemoPlaying] = useState<boolean>(false);
  const [loopRecording, setLoopRecording] = useState<boolean>(false);
  const [liveLatchMode, setLiveLatchMode] = useState<boolean>(true);
  const [autoQuantize, setAutoQuantize] = useState<boolean>(true);
  const [metronomeOn, setMetronomeOn] = useState<boolean>(false);
  const [recordedEvents, setRecordedEvents] = useState<RecordedEvent[]>([]);
  const [currentStep16, setCurrentStep16] = useState<number>(0);
  const [currentLoopBeat, setCurrentLoopBeat] = useState<number>(0);
  const [mutedTracks, setMutedTracks] = useState<{ drums: boolean; bass: boolean; synth: boolean }>({
    drums: false,
    bass: false,
    synth: false,
  });
  const [customPadLabels, setCustomPadLabels] = useState<Record<string, string>>({});
  const [stepGrid, setStepGrid] = useState<StepGridState>(() => ({
    A: createEmptyGrid(),
    B: createEmptyGrid(),
  }));
  const [mutedPads, setMutedPads] = useState<Record<'A' | 'B', boolean[]>>(() => ({
    A: Array(8).fill(false),
    B: Array(8).fill(false),
  }));

  // Refs for real-time audio clock access
  const heldNotesRef = useRef<number[]>([]);
  const heldPadsRef = useRef<Set<number>>(new Set());
  const arpStepIndexRef = useRef<number>(0);
  const arpDirectionRef = useRef<1 | -1>(1);
  const tapTimesRef = useRef<number[]>([]);
  const loopStartRef = useRef<number>(performance.now());
  const currentLoopBeatRef = useRef<number>(0);
  const recordedEventsRef = useRef<RecordedEvent[]>([]);
  const activeRecordedNotesRef = useRef<Map<number, { id: string; startMs: number }>>(new Map());
  const stepGridRef = useRef<StepGridState>(stepGrid);
  const mutedPadsRef = useRef<Record<'A' | 'B', boolean[]>>(mutedPads);
  const mutedTracksRef = useRef(mutedTracks);
  const padVelocityConfigRef = useRef<PadVelocityConfig>(padVelocityConfig);
  currentLoopBeatRef.current = currentLoopBeat;
  recordedEventsRef.current = recordedEvents;
  stepGridRef.current = stepGrid;
  mutedPadsRef.current = mutedPads;
  mutedTracksRef.current = mutedTracks;
  padVelocityConfigRef.current = padVelocityConfig;

  // Compute which pads (0..7) in current padBank are actively looping in recordedEvents
  const loopingPads = React.useMemo(() => {
    const active = new Set<number>();
    recordedEvents.forEach((ev) => {
      if (ev.type === 'pad' && (ev.bank || 'A') === padBank) {
        active.add(ev.index);
      }
    });
    return active;
  }, [recordedEvents, padBank]);

  // Restore saved offline session on initial mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_SESSION_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        if (typeof saved.programId === 'number') {
          const foundProg =
            PROGRAM_PRESETS.find((p) => p.id === saved.programId) || PROGRAM_PRESETS[0];
          setProgram(foundProg);
          soundEngine.setProgram(foundProg);
        }
        if (saved.keyboardVoice) {
          setKeyboardVoice(saved.keyboardVoice);
          soundEngine.setKeyboardVoiceMode(saved.keyboardVoice);
        }
        if (saved.knobs && typeof saved.knobs === 'object') {
          setKnobs(saved.knobs);
          soundEngine.updateKnobs(saved.knobs);
        }
        if (typeof saved.bpm === 'number' && saved.bpm >= 40 && saved.bpm <= 220) {
          setBpm(saved.bpm);
        }
        if (saved.timeDivision) setTimeDivision(saved.timeDivision);
        if (saved.arpMode) setArpMode(saved.arpMode);
        if (saved.arpOctaves) setArpOctaves(saved.arpOctaves);
        if (saved.swing) setSwing(saved.swing);
        if (saved.padVelocityConfig) setPadVelocityConfig(saved.padVelocityConfig);
        if (saved.stepGrid && saved.stepGrid.A && saved.stepGrid.B) {
          setStepGrid(saved.stepGrid);
        }
        if (Array.isArray(saved.recordedEvents)) {
          setRecordedEvents(saved.recordedEvents);
        }
        if (typeof saved.masterVol === 'number') {
          setMasterVol(saved.masterVol);
          soundEngine.setMasterVolume(saved.masterVol);
        }
      }
    } catch {
      // Ignore corrupt localStorage state
    }
  }, []);

  // Automatically persist active studio session to localStorage for seamless offline reload
  useEffect(() => {
    try {
      const payload = {
        programId: program.id,
        keyboardVoice,
        knobs,
        bpm,
        timeDivision,
        arpMode,
        arpOctaves,
        swing,
        padVelocityConfig,
        stepGrid,
        recordedEvents,
        masterVol,
      };
      localStorage.setItem(OFFLINE_SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    program.id,
    keyboardVoice,
    knobs,
    bpm,
    timeDivision,
    arpMode,
    arpOctaves,
    swing,
    padVelocityConfig,
    stepGrid,
    recordedEvents,
    masterVol,
  ]);

  const baseMidiNote = 48 + octaveShift * 12; // Default C3 = 48

  // Switch Hardware Program (1..4)
  const selectProgram = useCallback((progId: number) => {
    const found = PROGRAM_PRESETS.find((p) => p.id === progId) || PROGRAM_PRESETS[0];
    setProgram(found);
    setKnobs({ ...found.defaultKnobs });
    soundEngine.setProgram(found);
    soundEngine.updateKnobs(found.defaultKnobs);
    setLcdStatus(`PROG ${found.id}: ${found.name.toUpperCase()}`);
    setProgSelectActive(false);
  }, []);

  // Update a single knob parameter
  const handleKnobChange = useCallback(
    (key: keyof KnobParameters, value: number) => {
      setKnobs((prev) => {
        const next = { ...prev, [key]: value };
        soundEngine.updateKnobs(next);
        return next;
      });
    },
    []
  );

  // Handle Thumbstick
  const handleThumbstickChange = useCallback((pitch: number, mod: number) => {
    setPitchBend(pitch);
    setModWheel(mod);
    soundEngine.setThumbstick(pitch, mod);
    if (pitch !== 0 || mod !== 0) {
      setLcdStatus(`PITCH ${pitch >= 0 ? '+' : ''}${Math.round(pitch * 100)}% · MOD ${Math.round(mod * 100)}%`);
    }
  }, []);

  // Handle Arpeggiator Secondary Key Function Selection
  const handleArpFunctionSelect = useCallback((action: KeyDefinition['arpAction']) => {
    switch (action.type) {
      case 'div':
        setTimeDivision(action.value);
        setLcdStatus(`TIME DIVISION: ${action.value}`);
        break;
      case 'mode':
        setArpMode(action.value);
        setLcdStatus(`ARP MODE: ${action.value}`);
        break;
      case 'latch':
        setArpLatch((prev) => {
          const next = !prev;
          if (!next) {
            setLatchedNotes([]);
            heldNotesRef.current = [];
          }
          setLcdStatus(`ARP LATCH: ${next ? 'ON' : 'OFF'}`);
          return next;
        });
        break;
      case 'oct':
        setArpOctaves(action.value);
        setLcdStatus(`ARP RANGE: ${action.value} OCTAVE${action.value > 1 ? 'S' : ''}`);
        break;
      case 'swing':
        setSwing(action.value);
        setLcdStatus(`SWING: ${action.value}%`);
        break;
    }
  }, []);

  // Toggle an MPC Pad's continuous loop pattern in the live beat
  const handleTogglePadLoop = useCallback(
    (padIndex: number, vel = 116) => {
      const padLabel =
        padBank === 'A' ? program.padNamesA[padIndex] : program.padNamesB[padIndex];

      // Clear any background 16-step demo preset grid so ONLY the pad(s) the user clicked will play
      setStepGrid({
        A: createEmptyGrid(),
        B: createEmptyGrid(),
      });

      setRecordedEvents((prev) => {
        const alreadyLooping = prev.some(
          (ev) => ev.type === 'pad' && ev.index === padIndex && (ev.bank || 'A') === padBank
        );

        if (alreadyLooping) {
          const remaining = prev.filter(
            (ev) => !(ev.type === 'pad' && ev.index === padIndex && (ev.bank || 'A') === padBank)
          );
          if (remaining.length === 0) {
            setDemoPlaying(false);
          }
          setLcdStatus(`STOPPED PAD ${padIndex + 1} LOOP (${padLabel.toUpperCase()})`);
          return remaining;
        }

        const patternSteps = PAD_LOOP_PATTERNS_32[padIndex] || [0, 8, 16, 24];
        const newPadEvents: RecordedEvent[] = patternSteps.map((step32) => ({
          id: `latch-pad-${padBank}-${padIndex}-${step32}-${Date.now()}-${Math.random()}`,
          beatOffset: step32 * 0.25,
          type: 'pad',
          index: padIndex,
          bank: padBank,
          velocity: vel,
          durationBeats: 0.25,
        }));

        setDemoPlaying(true);
        setLcdStatus(`PAD ${padIndex + 1} (${padLabel.toUpperCase()}) LOOPING IN BEAT`);
        return [...prev, ...newPadEvents];
      });

      setMutedTracks((prev) => ({ ...prev, drums: false }));
    },
    [padBank, program]
  );

  // Layer / Join an Electric Bass Guitar groove into the currently playing beat
  const handleJoinBassGroove = useCallback(
    (bassVoice: KeyboardVoiceMode, rootMidi = 48) => {
      const voiceToUse: KeyboardVoiceMode =
        bassVoice === 'synth' ? 'finger-bass' : bassVoice;
      setKeyboardVoice(voiceToUse);
      soundEngine.setKeyboardVoiceMode(voiceToUse);

      // Audition the root bass note immediately so the user hears the bass join in
      soundEngine.noteOn(rootMidi, 118, voiceToUse);
      setTimeout(() => soundEngine.noteOff(rootMidi), 220);

      // Build a 2-bar (32 sixteenth-note) Electric Bass Guitar groove around rootMidi
      const r = Math.max(36, Math.min(60, rootMidi));
      const pattern: [number, number, number, number][] =
        voiceToUse === 'slap-bass'
          ? [
              [0, r, 0.35, 124],
              [2, r + 12, 0.25, 126],
              [3, r, 0.25, 112],
              [6, r + 3, 0.5, 120],
              [8, r + 5, 0.35, 124],
              [10, r + 17, 0.25, 126],
              [12, r + 7, 0.5, 120],
              [14, r + 19, 0.25, 124],
              [16, r, 0.35, 124],
              [18, r + 12, 0.25, 126],
              [20, r + 3, 0.5, 118],
              [22, r + 5, 0.35, 122],
              [24, r + 7, 0.35, 125],
              [26, r + 19, 0.25, 126],
              [28, r + 5, 0.5, 120],
              [30, r + 3, 0.35, 118],
            ]
          : voiceToUse === 'picked-bass'
          ? Array.from({ length: 16 }, (_, i) => {
              const step32 = i * 2;
              const note =
                step32 < 8 ? r : step32 < 16 ? r + 7 : step32 < 24 ? r + 5 : r + 3;
              return [step32, note, 0.35, step32 % 4 === 0 ? 122 : 108];
            })
          : [
              // Fingered P-Bass / Fretless Bass groove
              [0, r, 0.75, 122],
              [3, r + 3, 0.5, 114],
              [6, r + 5, 0.5, 118],
              [8, r + 7, 0.75, 124],
              [12, r + 3, 0.75, 116],
              [16, r, 0.75, 122],
              [19, r + 3, 0.5, 114],
              [22, r + 7, 0.5, 120],
              [24, r + 5, 0.75, 122],
              [28, r + 2, 0.75, 116],
            ];

      const bassEvents: RecordedEvent[] = pattern.map(([step32, midi, dur, vel]) => ({
        id: `latch-bass-${voiceToUse}-${step32}-${Date.now()}-${Math.random()}`,
        beatOffset: step32 * 0.25,
        type: 'note',
        index: midi,
        velocity: vel,
        durationBeats: dur,
        voiceMode: voiceToUse,
      }));

      setRecordedEvents((prev) => {
        const withoutOldBass = prev.filter(
          (ev) => !(ev.type === 'note' && ev.voiceMode && ev.voiceMode !== 'synth')
        );
        return [...withoutOldBass, ...bassEvents];
      });

      setMutedTracks((prev) => ({ ...prev, bass: false }));
      setDemoPlaying(true);
      const voiceLabel =
        KEYBOARD_VOICE_OPTIONS.find((v) => v.id === voiceToUse)?.label || 'Bass Guitar';
      setLcdStatus(`${voiceLabel.toUpperCase()} JOINED THE BEAT`);
    },
    []
  );

  // Trigger MPC Pad (0..7)
  // rawOrVelocity: if <= 1.0, treated as normalized strike force (0..1); if > 1, converted from raw MIDI velocity
  const handlePadDown = useCallback(
    (padIndex: number, rawOrVelocity = 0.78) => {
      // If PROG SELECT is active and user presses PAD 5..8 (indices 4..7), switch Program 1..4!
      if (progSelectActive && padIndex >= 4 && padIndex <= 7) {
        selectProgram(padIndex - 3);
        return;
      }

      const rawInputNorm =
        rawOrVelocity <= 1
          ? Math.max(0, Math.min(1, rawOrVelocity))
          : Math.max(0, Math.min(1, (rawOrVelocity - 40) / 87));

      const vel = computePadVelocity(rawInputNorm, padVelocityConfig, fullLevel);
      const padLabel =
        padBank === 'A' ? program.padNamesA[padIndex] : program.padNamesB[padIndex];

      setActivePads((prev) => new Set(prev).add(padIndex));
      heldPadsRef.current.add(padIndex);

      if (!noteRepeat) {
        soundEngine.triggerPad(padIndex, padBank, vel);
      }

      setLastPadHit({
        padIndex,
        padName: padLabel,
        rawInputNorm,
        outputVelocity: vel,
        timestamp: Date.now(),
      });

      if (loopRecording) {
        const rawBeat = currentLoopBeatRef.current;
        const beatOffset = autoQuantize
          ? ((Math.round(rawBeat / 0.25) * 0.25) % 8 + 8) % 8
          : rawBeat;
        setRecordedEvents((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            beatOffset,
            type: 'pad',
            index: padIndex,
            bank: padBank,
            velocity: vel,
            durationBeats: 0.25,
          },
        ]);
        if (!demoPlaying) setDemoPlaying(true);
        setLcdStatus(
          `REC PAD ${padIndex + 1} [${padBank}] · ${padLabel.toUpperCase()} · VEL ${vel}`
        );
      } else if (liveLatchMode) {
        // Live Pad Latch mode: clicking a pad keeps it playing in the beat loop!
        handleTogglePadLoop(padIndex, vel);
      } else {
        setLcdStatus(
          `PAD ${padIndex + 1} [${padBank}] · ${padLabel.toUpperCase()} · VEL ${vel} (${
            fullLevel ? 'FULL' : padVelocityConfig.curve.toUpperCase()
          })`
        );
      }
    },
    [
      progSelectActive,
      selectProgram,
      padVelocityConfig,
      fullLevel,
      padBank,
      program,
      noteRepeat,
      loopRecording,
      autoQuantize,
      demoPlaying,
      liveLatchMode,
      handleTogglePadLoop,
    ]
  );

  const handlePadUp = useCallback((padIndex: number) => {
    setActivePads((prev) => {
      const next = new Set(prev);
      next.delete(padIndex);
      return next;
    });
    heldPadsRef.current.delete(padIndex);
  }, []);

  // Trigger Keyboard Note
  const handleNoteDown = useCallback(
    (midiNote: number, keyDef?: KeyDefinition) => {
      // If holding Arp Config mode, pressing a key configures the Arpeggiator
      if (arpConfigHold && keyDef) {
        handleArpFunctionSelect(keyDef.arpAction);
        return;
      }

      const vel = fullLevel ? 127 : 105;
      setActiveNotes((prev) => new Set(prev).add(midiNote));

      if (!heldNotesRef.current.includes(midiNote)) {
        heldNotesRef.current = [...heldNotesRef.current, midiNote];
      }
      if (arpOn && arpLatch) {
        setLatchedNotes((prev) => (prev.includes(midiNote) ? prev : [...prev, midiNote]));
      }

      if (!arpOn) {
        soundEngine.noteOn(midiNote, vel);
      }

      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const name = `${noteNames[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`;

      if (loopRecording && !arpOn) {
        const nowMs = performance.now();
        const rawBeat = currentLoopBeatRef.current;
        const beatOffset = autoQuantize
          ? ((Math.round(rawBeat / 0.25) * 0.25) % 8 + 8) % 8
          : rawBeat;
        const eventId = `${Date.now()}-${Math.random()}`;
        activeRecordedNotesRef.current.set(midiNote, { id: eventId, startMs: nowMs });
        setRecordedEvents((prev) => [
          ...prev,
          {
            id: eventId,
            beatOffset,
            type: 'note',
            index: midiNote,
            velocity: vel,
            durationBeats: 0.5,
            voiceMode: keyboardVoice,
          },
        ]);
        if (!demoPlaying) setDemoPlaying(true);
        setLcdStatus(`REC NOTE ${name} (${keyboardVoice.toUpperCase()}) · VEL ${vel}`);
      } else if (liveLatchMode && keyboardVoice !== 'synth' && !arpOn) {
        // In Live Latch Mode, pressing any Bass Guitar key joins/shifts the Bass groove in the playing beat!
        handleJoinBassGroove(keyboardVoice, midiNote);
      } else {
        setLcdStatus(`NOTE ${name} (${midiNote}) · VEL ${vel}`);
      }
    },
    [
      arpConfigHold,
      handleArpFunctionSelect,
      fullLevel,
      arpOn,
      arpLatch,
      loopRecording,
      autoQuantize,
      demoPlaying,
      liveLatchMode,
      keyboardVoice,
      handleJoinBassGroove,
    ]
  );

  const handleNoteUp = useCallback(
    (midiNote: number) => {
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(midiNote);
        return next;
      });

      const pendingRec = activeRecordedNotesRef.current.get(midiNote);
      if (pendingRec) {
        activeRecordedNotesRef.current.delete(midiNote);
        const heldSec = Math.max(0.05, (performance.now() - pendingRec.startMs) / 1000);
        const heldBeats = Math.max(0.125, Math.min(8, heldSec * (bpm / 60)));
        setRecordedEvents((prev) =>
          prev.map((ev) => (ev.id === pendingRec.id ? { ...ev, durationBeats: heldBeats } : ev))
        );
      }

      if (!arpLatch) {
        heldNotesRef.current = heldNotesRef.current.filter((n) => n !== midiNote);
      }

      if (!arpOn) {
        soundEngine.noteOff(midiNote);
      }
    },
    [arpLatch, arpOn, bpm]
  );

  const handleExportMidi = useCallback(() => {
    const combinedEvents: RecordedEvent[] = [...recordedEvents];

    // Also include active steps from the 16-Step Drum Grid Sequencer
    (['A', 'B'] as const).forEach((bank) => {
      const grid = stepGrid[bank];
      const mutes = mutedPads[bank];
      for (let padIdx = 0; padIdx < 8; padIdx++) {
        if (mutes[padIdx]) continue;
        for (let stepIdx = 0; stepIdx < 16; stepIdx++) {
          const val = grid[padIdx][stepIdx];
          if (val > 0) {
            combinedEvents.push({
              id: `seq-${bank}-${padIdx}-${stepIdx}`,
              beatOffset: stepIdx * 0.25,
              type: 'pad',
              index: padIdx,
              bank,
              velocity: val === 2 ? 127 : 105,
              durationBeats: 0.25,
            });
          }
        }
      }
    });

    if (combinedEvents.length === 0) {
      setLcdStatus('ADD STEPS OR RECORD A LOOP TO EXPORT MIDI');
      return;
    }

    exportLoopToMidiFile(combinedEvents, bpm, program.name);
    setLcdStatus(`MIDI EXPORTED (${combinedEvents.length} EVENTS · ${bpm} BPM)`);
  }, [recordedEvents, stepGrid, mutedPads, bpm, program.name]);

  // Tap Tempo Calculation
  const handleTapTempo = () => {
    const now = performance.now();
    const recent = tapTimesRef.current.filter((t) => now - t < 2500);
    recent.push(now);
    tapTimesRef.current = recent;

    if (recent.length >= 2) {
      let sumIntervals = 0;
      for (let i = 1; i < recent.length; i++) {
        sumIntervals += recent[i] - recent[i - 1];
      }
      const avgMs = sumIntervals / (recent.length - 1);
      const nextBpm = Math.max(40, Math.min(220, Math.round(60000 / avgMs)));
      setBpm(nextBpm);
      setLcdStatus(`TAP TEMPO: ${nextBpm} BPM`);
    } else {
      setLcdStatus('TAP AGAIN TO SET TEMPO');
    }
  };

  // Master Clock for Arpeggiator, Note Repeat, Demo Groove, and Recorded Loop Playback
  useEffect(() => {
    const stepsPerBeat = TIME_DIV_STEPS_PER_BEAT[timeDivision];
    const baseStepMs = 60000 / bpm / stepsPerBeat;
    let stepCounter = 0;
    let timeoutId: number;

    const tick = () => {
      const isOddStep = stepCounter % 2 === 1;
      const swingFactor = isOddStep ? 1 + (swing - 50) / 50 : 1 - (swing - 50) / 50;
      const currentStepDurationMs = Math.max(25, baseStepMs * swingFactor);

      const stepSizeBeats = 1 / stepsPerBeat;
      const loopBeatPos =
        ((stepCounter * stepSizeBeats) % LOOP_LENGTH_BEATS + LOOP_LENGTH_BEATS) % LOOP_LENGTH_BEATS;
      setCurrentLoopBeat(loopBeatPos);

      // Quarter-note beat LED flash & Studio Metronome Click
      const stepsPerQuarter = Math.max(1, Math.round(stepsPerBeat));
      if (stepCounter % stepsPerQuarter === 0) {
        setBeatPulse(true);
        setTimeout(() => setBeatPulse(false), 90);
        if (metronomeOn && (demoPlaying || loopRecording)) {
          const quarterIndex = Math.floor(stepCounter / stepsPerQuarter) % 4;
          soundEngine.playMetronomeClick(quarterIndex === 0);
        }
      }

      const step16 = stepCounter % 16;
      setCurrentStep16(step16);

      // 1. Handle Note Repeat if active and any pads are held
      if (noteRepeat && heldPadsRef.current.size > 0) {
        const vel = computePadVelocity(0.82, padVelocityConfigRef.current, fullLevel);
        heldPadsRef.current.forEach((padIdx) => {
          soundEngine.triggerPad(padIdx, padBank, vel);
        });
      }

      // 2. Handle Arpeggiator if active
      const poolBase = arpLatch && latchedNotes.length > 0 ? latchedNotes : heldNotesRef.current;
      if (arpOn && poolBase.length > 0) {
        const sortedBase =
          arpMode === 'ORDER' ? [...poolBase] : [...poolBase].sort((a, b) => a - b);

        // Expand across selected ARP OCT 1..4
        const expandedPool: number[] = [];
        for (let oct = 0; oct < arpOctaves; oct++) {
          sortedBase.forEach((n) => expandedPool.push(n + oct * 12));
        }

        if (expandedPool.length > 0) {
          let chosenNote = expandedPool[0];
          const len = expandedPool.length;

          if (arpMode === 'UP' || arpMode === 'ORDER') {
            chosenNote = expandedPool[arpStepIndexRef.current % len];
            arpStepIndexRef.current = (arpStepIndexRef.current + 1) % len;
          } else if (arpMode === 'DOWN') {
            const revIdx = len - 1 - (arpStepIndexRef.current % len);
            chosenNote = expandedPool[revIdx];
            arpStepIndexRef.current = (arpStepIndexRef.current + 1) % len;
          } else if (arpMode === 'RAND') {
            chosenNote = expandedPool[Math.floor(Math.random() * len)];
          } else if (arpMode === 'INCL' || arpMode === 'EXCL') {
            if (len === 1) {
              chosenNote = expandedPool[0];
            } else {
              const idx = Math.max(0, Math.min(len - 1, arpStepIndexRef.current));
              chosenNote = expandedPool[idx];
              let nextIdx = idx + arpDirectionRef.current;
              if (nextIdx >= len) {
                arpDirectionRef.current = -1;
                nextIdx = arpMode === 'INCL' ? len - 1 : Math.max(0, len - 2);
              } else if (nextIdx < 0) {
                arpDirectionRef.current = 1;
                nextIdx = arpMode === 'INCL' ? 0 : Math.min(len - 1, 1);
              }
              arpStepIndexRef.current = nextIdx;
            }
          }

          const vel = fullLevel ? 127 : 108;
          soundEngine.noteOn(chosenNote, vel);
          setActiveNotes((prev) => new Set(prev).add(chosenNote));
          setTimeout(() => {
            soundEngine.noteOff(chosenNote);
            setActiveNotes((prev) => {
              const next = new Set(prev);
              next.delete(chosenNote);
              return next;
            });
          }, currentStepDurationMs * 0.72);
        }
      }

      // 3. Handle 16-Step Drum Grid Sequencer & Demo Groove playback
      if (demoPlaying && !mutedTracksRef.current.drums) {
        (['A', 'B'] as const).forEach((bank) => {
          const bankGrid = stepGridRef.current[bank];
          const bankMutes = mutedPadsRef.current[bank];
          for (let padIdx = 0; padIdx < 8; padIdx++) {
            if (bankMutes[padIdx]) continue;
            const stepVal = bankGrid[padIdx][step16];
            if (stepVal > 0) {
              const vel = fullLevel ? 127 : stepVal === 2 ? 126 : 104;
              soundEngine.triggerPad(padIdx, bank, vel);
              if (bank === padBank) {
                setActivePads((p) => new Set(p).add(padIdx));
                setTimeout(() => {
                  setActivePads((p) => {
                    const n = new Set(p);
                    n.delete(padIdx);
                    return n;
                  });
                }, 110);
              }
            }
          }
        });
      }

      // 4. Play back recorded loop events matching the current beat window
      if (recordedEventsRef.current.length > 0 && (demoPlaying || loopRecording)) {
        recordedEventsRef.current.forEach((ev) => {
          const delta =
            ((ev.beatOffset - loopBeatPos) % LOOP_LENGTH_BEATS + LOOP_LENGTH_BEATS) %
            LOOP_LENGTH_BEATS;
          if (delta < stepSizeBeats - 0.0001 || Math.abs(delta) < 0.001) {
            if (ev.type === 'pad') {
              if (mutedTracksRef.current.drums) return;
              soundEngine.triggerPad(ev.index, ev.bank || 'A', ev.velocity);
              setActivePads((p) => new Set(p).add(ev.index));
              setTimeout(() => {
                setActivePads((p) => {
                  const n = new Set(p);
                  n.delete(ev.index);
                  return n;
                });
              }, 110);
            } else {
              const isBassEvent = ev.voiceMode && ev.voiceMode !== 'synth';
              if (isBassEvent && mutedTracksRef.current.bass) return;
              if (!isBassEvent && mutedTracksRef.current.synth) return;

              const durMs = Math.max(90, (ev.durationBeats ?? 0.5) * (60000 / bpm) * 0.85);
              soundEngine.noteOn(ev.index, ev.velocity, ev.voiceMode);
              setActiveNotes((p) => new Set(p).add(ev.index));
              setTimeout(() => {
                soundEngine.noteOff(ev.index);
                setActiveNotes((p) => {
                  const n = new Set(p);
                  n.delete(ev.index);
                  return n;
                });
              }, durMs);
            }
          }
        });
      }

      stepCounter++;
      timeoutId = window.setTimeout(tick, currentStepDurationMs);
    };

    timeoutId = window.setTimeout(tick, baseStepMs);
    return () => clearTimeout(timeoutId);
  }, [
    bpm,
    timeDivision,
    swing,
    noteRepeat,
    fullLevel,
    padBank,
    arpOn,
    arpLatch,
    latchedNotes,
    arpMode,
    arpOctaves,
    demoPlaying,
    loopRecording,
    metronomeOn,
  ]);

  // Computer Keyboard Support (25 keys + 8 pads + Octave)
  useEffect(() => {
    const keyMap = new Map<string, KeyDefinition>();
    KEYBED_25.forEach((k) => keyMap.set(k.keyBinding.toLowerCase(), k));

    const padKeyMap: Record<string, number> = {
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 3,
      '5': 4,
      '6': 5,
      '7': 6,
      '8': 7,
    };

    const downKeys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (downKeys.has(key)) return;
      downKeys.add(key);

      if (e.key === 'ArrowLeft') {
        setOctaveShift((prev) => Math.max(-3, prev - 1));
        return;
      }
      if (e.key === 'ArrowRight') {
        setOctaveShift((prev) => Math.min(3, prev + 1));
        return;
      }

      const keyDef = keyMap.get(key);
      if (keyDef) {
        const midiNote = baseMidiNote + keyDef.offset;
        handleNoteDown(midiNote, keyDef);
        return;
      }

      if (padKeyMap[key] !== undefined) {
        handlePadDown(padKeyMap[key], 115);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      downKeys.delete(key);

      const keyDef = keyMap.get(key);
      if (keyDef) {
        const midiNote = baseMidiNote + keyDef.offset;
        handleNoteUp(midiNote);
        return;
      }

      if (padKeyMap[key] !== undefined) {
        handlePadUp(padKeyMap[key]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [baseMidiNote, handleNoteDown, handleNoteUp, handlePadDown, handlePadUp]);

  // Top row is PAD 5..8, Bottom row is PAD 1..4 (Exact AKAI MPK mini layout)
  const topRowPads = [
    { index: 4, label: 'PAD 5', progLabel: 'PROG 1', progId: 1 },
    { index: 5, label: 'PAD 6', progLabel: 'PROG 2', progId: 2 },
    { index: 6, label: 'PAD 7', progLabel: 'PROG 3', progId: 3 },
    { index: 7, label: 'PAD 8', progLabel: 'PROG 4', progId: 4 },
  ];
  const bottomRowPads = [
    { index: 0, label: 'PAD 1' },
    { index: 1, label: 'PAD 2' },
    { index: 2, label: 'PAD 3' },
    { index: 3, label: 'PAD 4' },
  ];

  const PAD_SHORTCUT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'];

  const handleGlobalMouseOver = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const hwEl = target.closest('[data-hw-title]') as HTMLElement | null;
    if (hwEl) {
      const rect = hwEl.getBoundingClientRect();
      setHoveredControl({
        title: hwEl.getAttribute('data-hw-title') || '',
        func: hwEl.getAttribute('data-hw-func') || '',
        shortcut: hwEl.getAttribute('data-hw-shortcut') || undefined,
        state: hwEl.getAttribute('data-hw-state') || undefined,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
        },
      });
    } else {
      setHoveredControl(null);
    }
  }, []);

  const renderPad = (padIndex: number, label: string, progLabel?: string, progId?: number) => {
    const isPressed = activePads.has(padIndex);
    const customKey = `${program.id}-${padBank}-${padIndex}`;
    const sampleName =
      customPadLabels[customKey] ||
      (padBank === 'A' ? program.padNamesA[padIndex] : program.padNamesB[padIndex]);
    const isCurrentProg = progSelectActive && progId === program.id;
    const shortcutKey = PAD_SHORTCUT_KEYS[padIndex];

    const activeClass =
      padBank === 'A' ? 'mpk-pad-active-red border-red-500' : 'mpk-pad-active-green border-emerald-400';
    const idleBorderClass =
      progSelectActive && progId
        ? isCurrentProg
          ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.65)]'
          : 'border-red-500/50 animate-pulse'
        : padBank === 'A'
        ? 'border-zinc-400/75 hover:border-red-400'
        : 'border-emerald-500/55 hover:border-emerald-400 mpk-pad-green-hover';

    const padModeLabel = padCCMode
      ? `MIDI CC #${20 + padIndex}`
      : padProgChangeMode
      ? `Program Change #${padIndex + 1}`
      : `Drum Voice (${sampleName})`;

    const padFunctionText =
      progSelectActive && progId
        ? `PROG SELECT ARMED: Click this pad to immediately load Hardware Preset ${progLabel}.`
        : `Velocity-sensitive MPC drum pad triggering "${sampleName}" in Bank ${padBank}. Hit lower on the pad for higher velocity${
            noteRepeat ? ' (Hold down for Note Repeat rolls)' : ''
          }.`;

    return (
      <div key={padIndex} className="flex flex-col group">
        {/* Hardware Silkscreen Header above Pad */}
        <div className="flex items-center justify-between px-0.5 mb-1">
          <span className="text-[9px] font-extrabold tracking-tight text-zinc-200 group-hover:text-white leading-none transition-colors">
            {label}
          </span>
          {progLabel && (
            <button
              type="button"
              onClick={() => progId && selectProgram(progId)}
              data-hw-title={`LOAD ${progLabel}`}
              data-hw-func={`Switches the synthesizer engine, 8 rotary knob defaults, and MPC drum kit to ${progLabel}.`}
              data-hw-state={program.id === progId ? 'ACTIVE PROGRAM' : 'CLICK TO LOAD'}
              className={`text-[9px] font-extrabold tracking-tight leading-none cursor-pointer transition-all px-1 rounded ${
                program.id === progId
                  ? 'text-red-400 underline decoration-red-500/80 underline-offset-2'
                  : 'text-[#e11d48] hover:text-white hover:bg-red-600/30'
              }`}
            >
              {progLabel}
            </button>
          )}
        </div>

        {/* Velocity-Sensitive MPC Rubber Pad */}
        <button
          type="button"
          data-hw-title={`${label} [BANK ${padBank}] · ${sampleName.toUpperCase()}`}
          data-hw-func={padFunctionText}
          data-hw-shortcut={`Key [${shortcutKey}]`}
          data-hw-state={padModeLabel}
          onPointerDown={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            // Pass normalized vertical strike position (0 = top soft edge, 1 = bottom hard edge)
            // to be mapped by the active Velocity Curve (Linear, Exponential, or Fixed)
            handlePadDown(padIndex, relY);
          }}
          onPointerUp={() => handlePadUp(padIndex)}
          onPointerLeave={() => handlePadUp(padIndex)}
          className={`relative aspect-square w-full rounded-[4px] border-[2.5px] transition-all duration-75 flex flex-col justify-between p-2 text-left cursor-pointer touch-none ${
            isPressed ? `${activeClass} scale-[0.98]` : `mpk-pad ${idleBorderClass}`
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[8px] font-mono-tabular uppercase tracking-wider text-zinc-400/90 group-hover:text-zinc-200 transition-colors">
              {padCCMode ? `CC ${20 + padIndex}` : padProgChangeMode ? `PC ${padIndex + 1}` : `BANK ${padBank}`}
            </span>
            {loopingPads.has(padIndex) ? (
              <span className="text-[7.5px] font-mono-tabular font-extrabold px-1 py-0.2 rounded bg-red-600 text-white shadow-[0_0_6px_#ef4444]">
                LOOP
              </span>
            ) : (
              showKeyShortcuts &&
              !isPressed && (
                <span className="text-[8px] font-mono-tabular font-bold px-1 rounded bg-zinc-900/80 text-zinc-400 group-hover:text-white group-hover:bg-red-600/80 transition-colors">
                  {shortcutKey}
                </span>
              )
            )}
            {isPressed && !loopingPads.has(padIndex) && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  padBank === 'A' ? 'bg-red-400 shadow-[0_0_6px_#ef4444]' : 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                }`}
              />
            )}
          </div>

          <span className="text-[10px] font-semibold text-zinc-300/90 group-hover:text-white leading-tight line-clamp-2 transition-colors">
            {sampleName}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div
      onMouseOver={handleGlobalMouseOver}
      onMouseLeave={() => setHoveredControl(null)}
      className="min-h-screen w-full bg-[#111215] text-zinc-100 flex flex-col justify-between overflow-x-hidden"
    >
      {/* Floating Hardware Function Inspector Callout */}
      <HardwareHoverCallout info={hoveredControl} />

      {/* Offline Connectivity Banner */}
      <OfflineBanner />

      {/* Top Bar Contract: Zone 1 Brand — Zone 2 Preset Links — Zone 3 Primary Demo Action */}
      <header className="w-full border-b border-zinc-800/80 bg-[#15171b] px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-display text-lg font-extrabold tracking-tight text-white whitespace-nowrap">
            AKAI <span className="text-red-500">MPK mini</span> Studio
          </span>
        </div>

        {/* 4 Hardware Program Preset Selectors */}
        <nav className="hidden xl:flex items-center gap-5 text-xs font-semibold text-zinc-400">
          {PROGRAM_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProgram(p.id)}
              data-hw-title={`HARDWARE PRESET · PROG ${p.id}: ${p.name.toUpperCase()}`}
              data-hw-func={`Loads ${p.name} (${p.category}) synthesizer voice, default 8-knob parameters, and Bank A/B MPC drum kits.`}
              data-hw-state={program.id === p.id ? 'ACTIVE PRESET' : 'CLICK TO LOAD'}
              className={`whitespace-nowrap shrink-0 transition-all pb-0.5 px-1.5 py-0.5 rounded cursor-pointer ${
                program.id === p.id
                  ? 'text-white border-b-2 border-red-500'
                  : 'hover:text-white hover:bg-zinc-800/80'
              }`}
            >
              PROG {p.id}: {p.name}
            </button>
          ))}
        </nav>

        {/* Primary Action: Offline Status + Install PWA + Toggle Live Demo Beat */}
        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            data-hw-title={demoPlaying ? 'STOP STUDIO DEMO GROOVE' : 'PLAY STUDIO DEMO GROOVE'}
            data-hw-func="Starts or stops the master 16-step MPC drum groove and live pad animation at the current tempo."
            data-hw-state={demoPlaying ? `PLAYING AT ${bpm} BPM` : 'STOPPED'}
            onClick={() => {
              setDemoPlaying((prev) => {
                const next = !prev;
                if (next) {
                  const hasGridSteps =
                    stepGrid.A.some((row) => row.some((v) => v > 0)) ||
                    stepGrid.B.some((row) => row.some((v) => v > 0));
                  if (recordedEvents.length === 0 && !hasGridSteps) {
                    setStepGrid((g) => ({ ...g, A: createPresetGridForProgram(program.id) }));
                  }
                }
                setLcdStatus(next ? 'DEMO GROOVE: PLAYING' : 'DEMO GROOVE: STOPPED');
                return next;
              });
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              demoPlaying
                ? 'bg-red-600 text-white shadow-[0_0_16px_rgba(220,38,38,0.5)]'
                : 'bg-zinc-100 text-zinc-900 hover:bg-white hover:shadow-[0_0_12px_rgba(255,255,255,0.3)]'
            }`}
          >
            {demoPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {demoPlaying ? 'Stop Demo Beat' : 'Play Demo Beat'}
          </button>
        </div>
      </header>

      {/* Main Studio Desk Stage */}
      <main className="flex-1 w-full max-w-[1320px] mx-auto px-3 sm:px-6 py-4 flex flex-col items-center justify-center gap-4">
        {/* Compact Studio Parameter & Loop Bar */}
        <div className="w-full bg-[#17191e] border border-zinc-800/90 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
          {/* OLED Readout + Live Oscilloscope */}
          <div className="flex items-center gap-3">
            <StudioOscilloscope />
            <div
              data-hw-title="STUDIO OLED DISPLAY"
              data-hw-func="Displays active hardware program, master clock BPM, time division, and live parameter/button feedback."
              className="bg-[#0b0c0e] border border-zinc-800 rounded px-3 py-1.5 min-w-[260px] max-w-[380px]"
            >
              <div className="flex items-center justify-between text-[9px] font-mono-tabular text-zinc-400">
                <span className="truncate">
                  {hoveredControl
                    ? `INSPECT · ${hoveredControl.title}`
                    : `PROG ${program.id} · ${
                        keyboardVoice === 'synth'
                          ? program.category.toUpperCase()
                          : KEYBOARD_VOICE_OPTIONS.find((v) => v.id === keyboardVoice)?.label.toUpperCase()
                      }`}
                </span>
                <span className="text-red-400 font-bold ml-2 shrink-0">{bpm} BPM · {timeDivision}</span>
              </div>
              <div
                className={`${
                  hoveredControl ? 'text-[9.5px] font-medium' : 'text-[11px] font-bold'
                } font-mono-tabular text-zinc-100 tracking-tight truncate mt-0.5`}
              >
                {hoveredControl ? hoveredControl.func : lcdStatus}
              </div>
            </div>
          </div>

          {/* Tempo Slider, Bass Guitar / Key Voice Selector, Loop Recorder & Keyboard Shortcut Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Keyboard Voice / Bass Guitar Articulation Selector */}
            <div className="flex items-center gap-1 bg-[#111216] border border-zinc-800 rounded-lg p-1">
              <span className="text-[10px] font-mono-tabular font-bold uppercase tracking-wider text-zinc-400 px-1.5">
                KEY VOICE
              </span>
              {KEYBOARD_VOICE_OPTIONS.map((opt) => {
                const isSelected = keyboardVoice === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-hw-title={`KEYBOARD INSTRUMENT · ${opt.label.toUpperCase()}`}
                    data-hw-func={opt.description}
                    data-hw-state={isSelected ? 'ACTIVE VOICE' : 'CLICK TO SELECT'}
                    onClick={() => {
                      setKeyboardVoice(opt.id);
                      soundEngine.setKeyboardVoiceMode(opt.id);
                      if (opt.id !== 'synth' && liveLatchMode) {
                        // Automatically join this Bass Guitar into the playing beat!
                        handleJoinBassGroove(opt.id, 48);
                      } else {
                        setLcdStatus(`KEY VOICE: ${opt.label.toUpperCase()}`);
                      }
                    }}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* BPM Control */}
            <div
              data-hw-title="MASTER TEMPO (BPM)"
              data-hw-func="Adjusts the global studio clock speed (50–200 BPM) driving the Arpeggiator, Note Repeat, Loop Recorder, and 16-Step Sequencer."
              data-hw-state={`${bpm} BPM`}
              className="flex items-center gap-2 bg-[#111216] border border-zinc-800 hover:border-red-500/60 transition-colors rounded-lg px-3 py-1.5"
            >
              <span className="text-[11px] font-mono-tabular text-zinc-400">TEMPO</span>
              <input
                type="range"
                min={50}
                max={200}
                value={bpm}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setBpm(val);
                  setLcdStatus(`TEMPO: ${val} BPM`);
                }}
                className="w-20 accent-red-600 cursor-pointer"
              />
              <span className="text-xs font-mono-tabular font-bold text-white w-14 text-right">
                {bpm} BPM
              </span>
            </div>

            {/* MPC Pad Velocity Curve Settings Toggle */}
            <button
              type="button"
              onClick={() => setShowPadVelocityPanel((prev) => !prev)}
              data-hw-title="MPC PAD VELOCITY CURVE & SENSITIVITY SETTINGS"
              data-hw-func="Opens or closes the MPC Drum Pad Velocity Curve panel to choose between Linear, Exponential, and Fixed velocity response curves."
              data-hw-state={`CURVE: ${padVelocityConfig.curve.toUpperCase()}`}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                showPadVelocityPanel
                  ? 'bg-red-600/20 border-red-500/70 text-red-200 hover:bg-red-600/30'
                  : 'bg-[#111216] border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-red-400" />
              <span>Pad Curve: {padVelocityConfig.curve.toUpperCase()}</span>
            </button>

            {/* Computer Key Labels Toggle */}
            <button
              type="button"
              onClick={() => setShowKeyShortcuts((prev) => !prev)}
              data-hw-title="COMPUTER KEYBOARD SHORTCUT LABELS"
              data-hw-func="Shows or hides the computer key bindings on the 25 piano keys (Z–M, Q–I) and 8 MPC drum pads (1–8)."
              data-hw-state={showKeyShortcuts ? 'VISIBLE' : 'HIDDEN'}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                showKeyShortcuts
                  ? 'bg-zinc-800 border-zinc-600 text-white hover:border-red-400'
                  : 'bg-[#111216] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Key Labels</span>
            </button>

            {/* Master Volume */}
            <div
              data-hw-title="MASTER STUDIO OUTPUT GAIN"
              data-hw-func="Controls the master volume level of the synthesizer, MPC drum sampler, and audio engine."
              data-hw-state={`VOLUME: ${Math.round(masterVol * 100)}%`}
              className="flex items-center gap-2 bg-[#111216] border border-zinc-800 hover:border-red-500/60 transition-colors rounded-lg px-3 py-1.5"
            >
              <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={masterVol}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMasterVol(v);
                  soundEngine.setMasterVolume(v);
                }}
                aria-label="Master Volume"
                className="w-16 accent-red-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* PHYSICAL AKAI PROFESSIONAL MPK MINI MK2 HARDWARE REPLICA              */}
        {/* ===================================================================== */}
        <div className="relative w-full flex items-stretch justify-center select-none">
          {/* Left Molded Red Side Cheek */}
          <div className="w-2.5 sm:w-3.5 rounded-l-2xl mpk-side-cheek-left shrink-0 my-1" />

          {/* Main Matte Black Hardware Chassis */}
          <div className="mpk-chassis flex-1 rounded-xl border border-zinc-800/90 px-3 sm:px-6 pt-5 pb-3 flex flex-col gap-3">
            {/* TOP CONTROL DECK: 3 Hardware Columns (Left Stick/Arp, Center 8 MPC Pads, Right 8 Knobs + Pad Controls) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
              {/* COLUMN 1 (Left 3 cols): Red 4-Way Thumbstick + Arpeggiator/Octave/Full Level/Note Repeat + AKAI MPK mini Logo */}
              <div className="lg:col-span-3 flex flex-col justify-between h-full gap-3">
                {/* Red 4-Way Pitch/Mod Thumbstick */}
                <div className="flex items-center justify-center lg:justify-start pl-2 pt-1">
                  <RedThumbstick
                    pitch={pitchBend}
                    mod={modWheel}
                    onChange={handleThumbstickChange}
                  />
                  <div className="ml-4 flex flex-col text-[10px] font-mono-tabular text-zinc-400">
                    <span>X: PITCH BEND</span>
                    <span>Y: FILTER MOD</span>
                    <button
                      type="button"
                      onClick={() => setArpConfigHold((prev) => !prev)}
                      data-hw-title="KEYBED ARP CONFIG MODE"
                      data-hw-func="When enabled, pressing any of the 25 mini keys selects its silkscreened Arpeggiator function (Time Division 1/4–1/32T, Mode, Latch, Octave, or Swing)."
                      data-hw-state={arpConfigHold ? 'CONFIG MODE: ON' : 'NORMAL PLAY MODE'}
                      className={`mpk-hw-btn mt-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                        arpConfigHold
                          ? 'bg-red-600/30 border-red-500 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                          : 'bg-zinc-900/90 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {arpConfigHold ? 'Key Config: ON' : 'Key Config'}
                    </button>
                  </div>
                </div>

                {/* ARPEGGIATOR / OCTAVE / FULL LEVEL / NOTE REPEAT 2x3 Button Matrix */}
                <div className="flex flex-col gap-2.5">
                  {/* ARPEGGIATOR Bracket Header */}
                  <div className="flex items-center gap-1.5">
                    <div className="h-[1px] flex-1 bg-zinc-500/70" />
                    <span className="text-[8.5px] font-extrabold tracking-widest text-zinc-200">
                      ARPEGGIATOR
                    </span>
                    <div className="h-[1px] flex-1 bg-zinc-500/70" />
                  </div>

                  {/* Row 1: ON/OFF & TAP TEMPO */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      data-hw-title="ARPEGGIATOR ON/OFF"
                      data-hw-func={`Cycles held synth keys automatically in a rhythmic pattern (${arpMode} mode at ${timeDivision} rate across ${arpOctaves} octave${arpOctaves > 1 ? 's' : ''}).`}
                      data-hw-state={arpOn ? `ON (${arpMode} · ${timeDivision})` : 'OFF'}
                      onClick={() => {
                        setArpOn((prev) => {
                          const next = !prev;
                          if (!next) {
                            soundEngine.allNotesOff();
                            setLatchedNotes([]);
                          }
                          setLcdStatus(`ARPEGGIATOR: ${next ? 'ON' : 'OFF'} (${arpMode} · ${timeDivision})`);
                          return next;
                        });
                      }}
                      className={`mpk-hw-btn h-9 rounded-[3px] border text-[9px] font-extrabold tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center ${
                        arpOn
                          ? 'bg-[#2a1619] border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.7),inset_0_0_6px_rgba(239,68,68,0.5)]'
                          : 'bg-[#23252a] border-zinc-400/70 text-zinc-200'
                      }`}
                    >
                      ON/OFF
                    </button>

                    <button
                      type="button"
                      onClick={handleTapTempo}
                      data-hw-title="TAP TEMPO"
                      data-hw-func="Click 2 or more times in rhythm to set the master studio BPM for the Arpeggiator, Note Repeat, and 16-Step Sequencer."
                      data-hw-state={`CURRENT: ${bpm} BPM`}
                      className={`mpk-hw-btn h-9 rounded-[3px] border text-[8.5px] font-extrabold tracking-wider uppercase leading-tight transition-all cursor-pointer flex flex-col items-center justify-center ${
                        beatPulse && (arpOn || noteRepeat || demoPlaying)
                          ? 'bg-[#2a1619] border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                          : 'bg-[#23252a] border-zinc-400/70 text-zinc-200'
                      }`}
                    >
                      <span>TAP</span>
                      <span>TEMPO</span>
                    </button>
                  </div>

                  {/* Row 2: OCTAVE < & OCTAVE > */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      data-hw-title="OCTAVE DOWN (<)"
                      data-hw-func="Transposes the 25-key synthesizer keyboard pitch down by 1 full octave (12 semitones), down to -3 octaves."
                      data-hw-shortcut="Key [←]"
                      data-hw-state={`OCTAVE SHIFT: ${octaveShift >= 0 ? `+${octaveShift}` : octaveShift}`}
                      onClick={() => {
                        setOctaveShift((prev) => {
                          const next = Math.max(-3, prev - 1);
                          setLcdStatus(`OCTAVE SHIFT: ${next >= 0 ? `+${next}` : next}`);
                          return next;
                        });
                      }}
                      className={`mpk-hw-btn h-9 rounded-[3px] border text-[9px] font-extrabold tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center ${
                        octaveShift < 0
                          ? 'bg-[#2a1619] border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.65)]'
                          : 'bg-[#23252a] border-zinc-400/70 text-zinc-200'
                      }`}
                    >
                      OCTAVE &lt;
                    </button>

                    <button
                      type="button"
                      data-hw-title="OCTAVE UP (>)"
                      data-hw-func="Transposes the 25-key synthesizer keyboard pitch up by 1 full octave (12 semitones), up to +3 octaves."
                      data-hw-shortcut="Key [→]"
                      data-hw-state={`OCTAVE SHIFT: ${octaveShift >= 0 ? `+${octaveShift}` : octaveShift}`}
                      onClick={() => {
                        setOctaveShift((prev) => {
                          const next = Math.min(3, prev + 1);
                          setLcdStatus(`OCTAVE SHIFT: ${next >= 0 ? `+${next}` : next}`);
                          return next;
                        });
                      }}
                      className={`mpk-hw-btn h-9 rounded-[3px] border text-[9px] font-extrabold tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center ${
                        octaveShift > 0
                          ? 'bg-[#2a1619] border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.65)]'
                          : 'bg-[#23252a] border-zinc-400/70 text-zinc-200'
                      }`}
                    >
                      OCTAVE &gt;
                    </button>
                  </div>

                  {/* Row 3: FULL LEVEL & NOTE REPEAT */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      data-hw-title="FULL LEVEL (MAX VELOCITY 127)"
                      data-hw-func="Forces all 8 MPC drum pads and 25 synth keys to trigger at maximum hard-hitting velocity (127), regardless of where you strike the pad."
                      data-hw-state={fullLevel ? 'ON (VELOCITY 127)' : 'OFF (DYNAMIC VELOCITY)'}
                      onClick={() => {
                        setFullLevel((prev) => {
                          const next = !prev;
                          setLcdStatus(`FULL LEVEL (VEL 127): ${next ? 'ON' : 'OFF'}`);
                          return next;
                        });
                      }}
                      className={`mpk-hw-btn h-9 rounded-[3px] border text-[8.5px] font-extrabold tracking-wider uppercase leading-tight transition-all cursor-pointer flex flex-col items-center justify-center ${
                        fullLevel
                          ? 'bg-[#2a1619] border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.7)]'
                          : 'bg-[#23252a] border-zinc-400/70 text-zinc-200'
                      }`}
                    >
                      <span>FULL</span>
                      <span>LEVEL</span>
                    </button>

                    <button
                      type="button"
                      data-hw-title="MPC NOTE REPEAT"
                      data-hw-func={`Hold down any MPC drum pad to automatically re-trigger rapid drum rolls locked to the active Time Division (${timeDivision}) and Swing (${swing}%).`}
                      data-hw-state={noteRepeat ? `ON (${timeDivision} · SWING ${swing}%)` : 'OFF'}
                      onClick={() => {
                        setNoteRepeat((prev) => {
                          const next = !prev;
                          setLcdStatus(`NOTE REPEAT (${timeDivision}): ${next ? 'ON' : 'OFF'}`);
                          return next;
                        });
                      }}
                      className={`mpk-hw-btn h-9 rounded-[3px] border text-[8.5px] font-extrabold tracking-wider uppercase leading-tight transition-all cursor-pointer flex flex-col items-center justify-center ${
                        noteRepeat
                          ? 'bg-[#2a1619] border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.7)]'
                          : 'bg-[#23252a] border-zinc-400/70 text-zinc-200'
                      }`}
                    >
                      <span>NOTE</span>
                      <span>REPEAT</span>
                    </button>
                  </div>
                </div>

                {/* Iconic AKAI PROFESSIONAL MPK mini Silkscreen Badge */}
                <div className="pt-1 flex items-baseline gap-2 select-none">
                  <div className="flex flex-col leading-none">
                    <span className="font-display font-black text-xl tracking-tighter text-white">
                      AKAI
                    </span>
                    <span className="text-[5.5px] font-bold tracking-[0.22em] text-zinc-300 uppercase -mt-0.5">
                      PROFESSIONAL
                    </span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="font-display font-black text-2xl tracking-tight text-[#e11d48]">
                      MPK
                    </span>
                    <span className="font-display font-bold text-lg tracking-tight text-[#e11d48] ml-0.5">
                      mini
                    </span>
                  </div>
                </div>
              </div>

              {/* COLUMN 2 (Center 5 cols): 8 Backlit Velocity-Sensitive MPC Drum Pads (2x4 Grid) */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-3">
                {/* Top Row: PAD 5..8 (with PROG 1..4 silkscreen) */}
                <div className="grid grid-cols-4 gap-3">
                  {topRowPads.map((p) => renderPad(p.index, p.label, p.progLabel, p.progId))}
                </div>

                {/* Bottom Row: PAD 1..4 */}
                <div className="grid grid-cols-4 gap-3">
                  {bottomRowPads.map((p) => renderPad(p.index, p.label))}
                </div>
              </div>

              {/* COLUMN 3 (Right 4 cols): 8 Assignable Rotary Knobs (K1..K8) + PAD CONTROLS (BANK A/B, CC, PROG CHANGE) + PROG SELECT */}
              <div className="lg:col-span-4 flex flex-col justify-between h-full gap-3">
                {/* Row 1 Knobs: K1..K4 */}
                <div className="grid grid-cols-4 gap-2">
                  <RotaryKnob
                    id="K1"
                    label="K1"
                    paramLabel="Cutoff"
                    value={knobs.k1Cutoff}
                    defaultValue={program.defaultKnobs.k1Cutoff}
                    onChange={(v) => handleKnobChange('k1Cutoff', v)}
                    onFocusParam={setLcdStatus}
                  />
                  <RotaryKnob
                    id="K2"
                    label="K2"
                    paramLabel="Reso"
                    value={knobs.k2Resonance}
                    defaultValue={program.defaultKnobs.k2Resonance}
                    onChange={(v) => handleKnobChange('k2Resonance', v)}
                    onFocusParam={setLcdStatus}
                  />
                  <RotaryKnob
                    id="K3"
                    label="K3"
                    paramLabel="Attack"
                    value={knobs.k3Attack}
                    defaultValue={program.defaultKnobs.k3Attack}
                    onChange={(v) => handleKnobChange('k3Attack', v)}
                    onFocusParam={setLcdStatus}
                  />
                  <RotaryKnob
                    id="K4"
                    label="K4"
                    paramLabel="Release"
                    value={knobs.k4Release}
                    defaultValue={program.defaultKnobs.k4Release}
                    onChange={(v) => handleKnobChange('k4Release', v)}
                    onFocusParam={setLcdStatus}
                  />
                </div>

                {/* Row 2 Knobs: K5..K8 */}
                <div className="grid grid-cols-4 gap-2">
                  <RotaryKnob
                    id="K5"
                    label="K5"
                    paramLabel="Detune"
                    value={knobs.k5Detune}
                    defaultValue={program.defaultKnobs.k5Detune}
                    onChange={(v) => handleKnobChange('k5Detune', v)}
                    onFocusParam={setLcdStatus}
                  />
                  <RotaryKnob
                    id="K6"
                    label="K6"
                    paramLabel="Sub Mix"
                    value={knobs.k6SubMix}
                    defaultValue={program.defaultKnobs.k6SubMix}
                    onChange={(v) => handleKnobChange('k6SubMix', v)}
                    onFocusParam={setLcdStatus}
                  />
                  <RotaryKnob
                    id="K7"
                    label="K7"
                    paramLabel="Delay"
                    value={knobs.k7DelayMix}
                    defaultValue={program.defaultKnobs.k7DelayMix}
                    onChange={(v) => handleKnobChange('k7DelayMix', v)}
                    onFocusParam={setLcdStatus}
                  />
                  <RotaryKnob
                    id="K8"
                    label="K8"
                    paramLabel="Reverb"
                    value={knobs.k8ReverbMix}
                    defaultValue={program.defaultKnobs.k8ReverbMix}
                    onChange={(v) => handleKnobChange('k8ReverbMix', v)}
                    onFocusParam={setLcdStatus}
                  />
                </div>

                {/* Bottom Row under Knobs: PAD CONTROLS (BANK A/B, CC, PROG CHANGE) + PROG SELECT */}
                <div className="grid grid-cols-4 gap-2.5 items-start pt-1">
                  {/* 3-Column PAD CONTROLS Bracketed Group */}
                  <div className="col-span-3 flex flex-col">
                    <div className="grid grid-cols-3 gap-2.5">
                      {/* BANK A/B Button (Lit Red for Bank A, Lit Green for Bank B — just like real MPK mini) */}
                      <button
                        type="button"
                        data-hw-title="PAD BANK A/B SWITCH"
                        data-hw-func="Toggles the 8 physical MPC drum pads between Bank A (Red LEDs, Pads 1–8) and Bank B (Green LEDs, Pads 9–16) for 16 total drum samples per program."
                        data-hw-state={`ACTIVE: BANK ${padBank} (${padBank === 'A' ? 'RED' : 'GREEN'})`}
                        onClick={() => {
                          setPadBank((prev) => {
                            const next = prev === 'A' ? 'B' : 'A';
                            setLcdStatus(`PAD BANK ${next} SELECTED (${next === 'A' ? 'RED' : 'GREEN'})`);
                            return next;
                          });
                        }}
                        className={`mpk-hw-btn h-9 rounded-[3px] border text-[8.5px] font-extrabold tracking-wider uppercase leading-tight transition-all cursor-pointer flex flex-col items-center justify-center ${
                          padBank === 'A'
                            ? 'bg-[#2a1619] border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.8),inset_0_0_6px_rgba(239,68,68,0.5)]'
                            : 'bg-[#14291f] border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.8),inset_0_0_6px_rgba(16,185,129,0.5)]'
                        }`}
                      >
                        <span>BANK</span>
                        <span>A/B</span>
                      </button>

                      {/* CC Button */}
                      <button
                        type="button"
                        data-hw-title="PAD MIDI CC MODE"
                        data-hw-func="Configures the 8 MPC pads to transmit MIDI Continuous Controller messages (CC #20–#27) alongside drum audio triggers."
                        data-hw-state={padCCMode ? 'ON (CC #20–#27)' : 'OFF (NOTE MODE)'}
                        onClick={() => {
                          setPadCCMode((prev) => {
                            const next = !prev;
                            setLcdStatus(`PAD MIDI CC MODE: ${next ? 'ON' : 'OFF'}`);
                            return next;
                          });
                        }}
                        className={`mpk-hw-btn h-9 rounded-[3px] border text-[9px] font-extrabold tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center ${
                          padCCMode
                            ? 'bg-[#2a1619] border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.7)]'
                            : 'bg-[#23252a] border-zinc-400/70 text-zinc-200'
                        }`}
                      >
                        CC
                      </button>

                      {/* PROG CHANGE Button */}
                      <button
                        type="button"
                        data-hw-title="PAD PROGRAM CHANGE MODE"
                        data-hw-func="Configures the 8 MPC pads to transmit MIDI Program Change messages (PC #1–#8)."
                        data-hw-state={padProgChangeMode ? 'ON (PC #1–#8)' : 'OFF'}
                        onClick={() => {
                          setPadProgChangeMode((prev) => {
                            const next = !prev;
                            setLcdStatus(`PAD PROG CHANGE: ${next ? 'ON' : 'OFF'}`);
                            return next;
                          });
                        }}
                        className={`mpk-hw-btn h-9 rounded-[3px] border text-[8px] font-extrabold tracking-wider uppercase leading-tight transition-all cursor-pointer flex flex-col items-center justify-center ${
                          padProgChangeMode
                            ? 'bg-[#2a1619] border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.7)]'
                            : 'bg-[#23252a] border-zinc-400/70 text-zinc-200'
                        }`}
                      >
                        <span>PROG</span>
                        <span>CHANGE</span>
                      </button>
                    </div>

                    {/* PAD CONTROLS Bracket Line Underneath */}
                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      <div className="h-1.5 w-[1px] bg-zinc-400/80 -mt-1" />
                      <div className="h-[1px] flex-1 bg-zinc-400/80" />
                      <span className="text-[8px] font-extrabold tracking-widest text-zinc-200">
                        PAD CONTROLS
                      </span>
                      <div className="h-[1px] flex-1 bg-zinc-400/80" />
                      <div className="h-1.5 w-[1px] bg-zinc-400/80 -mt-1" />
                    </div>
                  </div>

                  {/* PROG SELECT Button under K8 */}
                  <div className="col-span-1 flex flex-col">
                    <button
                      type="button"
                      data-hw-title="HARDWARE PROGRAM SELECT"
                      data-hw-func="Arms Program Select mode: while lit, press PAD 5, PAD 6, PAD 7, or PAD 8 to switch between hardware presets PROG 1–4."
                      data-hw-state={progSelectActive ? 'ARMED (PRESS PAD 5–8)' : `CURRENT: PROG ${program.id}`}
                      onClick={() => {
                        setProgSelectActive((prev) => {
                          const next = !prev;
                          setLcdStatus(
                            next
                              ? 'PRESS PAD 5-8 TO LOAD PROG 1-4'
                              : `PROG ${program.id}: ${program.name.toUpperCase()}`
                          );
                          return next;
                        });
                      }}
                      className={`mpk-hw-btn h-9 w-full rounded-[3px] border text-[8px] font-extrabold tracking-wider uppercase leading-tight transition-all cursor-pointer flex flex-col items-center justify-center ${
                        progSelectActive
                          ? 'bg-[#2a1619] border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.85)]'
                          : 'bg-[#23252a] border-zinc-400/70 text-zinc-200'
                      }`}
                    >
                      <span>PROG</span>
                      <span>SELECT</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM HALF: 25-Key Synth-Action Mini Keyboard + Silkscreened Arpeggiator/Swing Strip */}
            <Keybed25
              baseMidiNote={baseMidiNote}
              activeNotes={activeNotes}
              showKeyShortcuts={showKeyShortcuts}
              timeDivision={timeDivision}
              arpMode={arpMode}
              arpLatch={arpLatch}
              arpOctaves={arpOctaves}
              swing={swing}
              onNoteDown={handleNoteDown}
              onNoteUp={handleNoteUp}
              onArpFunctionSelect={handleArpFunctionSelect}
            />
          </div>

          {/* Right Molded Red Side Cheek */}
          <div className="w-2.5 sm:w-3.5 rounded-r-2xl mpk-side-cheek-right shrink-0 my-1" />
        </div>

        {/* Bottom Studio Quick Reference Strip (Unboxed clean metadata with middle-dot separators) */}
        <div className="w-full flex flex-wrap items-center justify-between gap-4 px-2 text-xs text-zinc-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-300">Controls</span>
            <span aria-hidden="true">·</span>
            <span>Keys: Z–M (Lower Octave) &amp; Q–I / A,F,K,L,O (Upper Octave)</span>
            <span aria-hidden="true">·</span>
            <span>Pads: 1–8</span>
            <span aria-hidden="true">·</span>
            <span>Octave Shift: Left/Right Arrows</span>
          </div>

          <div className="flex items-center gap-2 font-mono-tabular">
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span>Step {currentStep16 + 1}/16</span>
            <span aria-hidden="true">·</span>
            <span>Pad Curve: {padVelocityConfig.curve.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>Octave {octaveShift >= 0 ? `+${octaveShift}` : octaveShift}</span>
            <span aria-hidden="true">·</span>
            <span>Swing {swing}%</span>
          </div>
        </div>

        {/* MPC Drum Pad Sensitivity & Velocity Curve Settings Panel */}
        <PadVelocitySettingsPanel
          config={padVelocityConfig}
          fullLevel={fullLevel}
          lastHit={lastPadHit}
          isOpen={showPadVelocityPanel}
          onToggleOpen={() => setShowPadVelocityPanel((prev) => !prev)}
          onChangeConfig={(next) => {
            setPadVelocityConfig(next);
            setLcdStatus(
              next.curve === 'fixed'
                ? `PAD CURVE: FIXED (VEL ${next.fixedVelocity})`
                : `PAD CURVE: ${next.curve.toUpperCase()} (${next.minVelocity}–${next.maxVelocity})`
            );
          }}
          onToggleFullLevel={() => {
            setFullLevel((prev) => {
              const next = !prev;
              setLcdStatus(`FULL LEVEL (VEL 127): ${next ? 'ON' : 'OFF'}`);
              return next;
            });
          }}
          onTestStrike={(rawInputNorm) => {
            handlePadDown(0, rawInputNorm);
            setTimeout(() => handlePadUp(0), 120);
          }}
        />

        {/* Multi-Track Beat Maker & Loop Recorder Workstation */}
        <BeatStudioRecorder
          bpm={bpm}
          program={program}
          padBank={padBank}
          keyboardVoice={keyboardVoice}
          loopPlaying={demoPlaying}
          loopRecording={loopRecording}
          liveLatchMode={liveLatchMode}
          autoQuantize={autoQuantize}
          metronomeOn={metronomeOn}
          currentLoopBeat={currentLoopBeat}
          recordedEvents={recordedEvents}
          mutedTracks={mutedTracks}
          loopingPads={loopingPads}
          onTogglePlay={() => {
            setDemoPlaying((prev) => {
              const next = !prev;
              setLcdStatus(next ? 'BEAT PLAYBACK: RUNNING' : 'BEAT PLAYBACK: STOPPED');
              return next;
            });
          }}
          onToggleRecord={() => {
            setLoopRecording((prev) => {
              const next = !prev;
              if (next) {
                loopStartRef.current = performance.now();
                if (!demoPlaying) setDemoPlaying(true);
                setLcdStatus('OVERDUB RECORDING ARMED · PLAY PADS, BASS OR KEYS');
              } else {
                if (autoQuantize) {
                  setRecordedEvents((events) => quantizeEventsToSixteenthGrid(events));
                  setLcdStatus('BEAT RECORDING STOPPED · AUTO-QUANTIZED TO 1/16 GRID');
                } else {
                  setLcdStatus('BEAT RECORDING STOPPED · LOOP CAPTURED');
                }
              }
              return next;
            });
          }}
          onToggleLiveLatchMode={() => {
            setLiveLatchMode((prev) => {
              const next = !prev;
              setLcdStatus(
                next
                  ? 'LIVE PAD & BASS LATCH: ON (CLICK PAD OR BASS TO LOOP)'
                  : 'LIVE PAD & BASS LATCH: OFF (ONE-SHOT MODE)'
              );
              return next;
            });
          }}
          onTogglePadLoop={(padIdx) => handleTogglePadLoop(padIdx, 118)}
          onJoinBassGroove={(bassVoice, rootMidi) => handleJoinBassGroove(bassVoice, rootMidi ?? 48)}
          onToggleQuantize={() => {
            setAutoQuantize((prev) => {
              const next = !prev;
              if (next && recordedEvents.length > 0 && !loopRecording) {
                setRecordedEvents((events) => quantizeEventsToSixteenthGrid(events));
              }
              setLcdStatus(`AUTO-QUANTIZE (1/16): ${next ? 'ON' : 'OFF'}`);
              return next;
            });
          }}
          onToggleMetronome={() => {
            setMetronomeOn((prev) => {
              const next = !prev;
              setLcdStatus(`STUDIO CLICK TRACK: ${next ? 'ON' : 'OFF'}`);
              return next;
            });
          }}
          onToggleMuteTrack={(track) => {
            setMutedTracks((prev) => {
              const next = { ...prev, [track]: !prev[track] };
              setLcdStatus(`TRACK ${track.toUpperCase()}: ${next[track] ? 'MUTED' : 'UNMUTED'}`);
              return next;
            });
          }}
          onClearTrack={(track) => {
            if (track === 'all') {
              setRecordedEvents([]);
              setStepGrid({ A: createEmptyGrid(), B: createEmptyGrid() });
              setLoopRecording(false);
              setDemoPlaying(false);
              setLcdStatus('ALL RECORDED BEAT TRACKS CLEARED');
              return;
            }
            if (track === 'drums') {
              setStepGrid({ A: createEmptyGrid(), B: createEmptyGrid() });
            }
            setRecordedEvents((prev) =>
              prev.filter((ev) => {
                if (track === 'drums') return ev.type !== 'pad';
                const isBass = ev.type === 'note' && ev.voiceMode && ev.voiceMode !== 'synth';
                if (track === 'bass') return !isBass;
                return !(ev.type === 'note' && (!ev.voiceMode || ev.voiceMode === 'synth'));
              })
            );
            setLcdStatus(`CLEARED ${track.toUpperCase()} TRACK`);
          }}
          onAddQuickEvent={(ev) => {
            setRecordedEvents((prev) => [...prev, ev]);
            if (!demoPlaying) setDemoPlaying(true);
          }}
          onUndoLastEvent={() => {
            setRecordedEvents((prev) => prev.slice(0, -1));
            setLcdStatus('UNDID LAST BEAT EVENT');
          }}
          onDeleteEvent={(eventId) => {
            setRecordedEvents((prev) => prev.filter((e) => e.id !== eventId));
          }}
          onSelectKeyboardVoice={(voice) => {
            setKeyboardVoice(voice);
            soundEngine.setKeyboardVoiceMode(voice);
            if (voice !== 'synth' && liveLatchMode) {
              handleJoinBassGroove(voice, 48);
            } else {
              setLcdStatus(`KEYBOARD VOICE: ${voice.toUpperCase()}`);
            }
          }}
          onLoadStarterBeat={(presetId) => {
            const events: RecordedEvent[] = [];
            const pushPad = (step32: number, padIdx: number, vel = 116, bank: 'A' | 'B' = 'A') => {
              events.push({
                id: `preset-pad-${step32}-${padIdx}-${Math.random()}`,
                beatOffset: step32 * 0.25,
                type: 'pad',
                index: padIdx,
                bank,
                velocity: vel,
                durationBeats: 0.25,
              });
            };
            const pushNote = (
              step32: number,
              midi: number,
              durBeats: number,
              voice: KeyboardVoiceMode,
              vel = 114
            ) => {
              events.push({
                id: `preset-note-${step32}-${midi}-${Math.random()}`,
                beatOffset: step32 * 0.25,
                type: 'note',
                index: midi,
                velocity: vel,
                durationBeats: durBeats,
                voiceMode: voice,
              });
            };

            if (presetId === 'boombap') {
              setBpm(94);
              selectProgram(1);
              setStepGrid({ A: createEmptyGrid(), B: createEmptyGrid() });
              // Classic Boom-Bap Drums + Fingered P-Bass + Rhodes/Lead Chords
              [0, 3, 6, 8, 11, 16, 19, 22, 24, 27].forEach((s) => pushPad(s, 0, 124));
              [4, 12, 20, 28].forEach((s) => pushPad(s, 1, 122));
              for (let s = 0; s < 32; s += 2) pushPad(s, 2, s % 4 === 0 ? 110 : 92);
              // Fingered P-Bassline (C minor)
              pushNote(0, 36, 0.75, 'finger-bass', 120);
              pushNote(3, 39, 0.5, 'finger-bass', 112);
              pushNote(6, 41, 0.5, 'finger-bass', 116);
              pushNote(8, 43, 0.75, 'finger-bass', 122);
              pushNote(12, 39, 0.75, 'finger-bass', 114);
              pushNote(16, 36, 0.75, 'finger-bass', 122);
              pushNote(19, 39, 0.5, 'finger-bass', 112);
              pushNote(22, 43, 0.5, 'finger-bass', 118);
              pushNote(24, 41, 0.75, 'finger-bass', 120);
              pushNote(28, 38, 0.75, 'finger-bass', 115);
              // Synth chords
              [0, 16].forEach((s) => {
                pushNote(s, 60, 1.5, 'synth', 98);
                pushNote(s, 63, 1.5, 'synth', 96);
                pushNote(s, 67, 1.5, 'synth', 98);
              });
              [8, 24].forEach((s) => {
                pushNote(s, 58, 1.5, 'synth', 96);
                pushNote(s, 62, 1.5, 'synth', 95);
                pushNote(s, 65, 1.5, 'synth', 96);
              });
            } else if (presetId === 'funk-slap') {
              setBpm(108);
              selectProgram(3);
              setStepGrid({ A: createEmptyGrid(), B: createEmptyGrid() });
              [0, 6, 8, 14, 16, 22, 24, 30].forEach((s) => pushPad(s, 0, 125));
              [4, 12, 20, 28].forEach((s) => pushPad(s, 1, 124));
              for (let s = 0; s < 32; s += 2) pushPad(s, 2, 105);
              // Slap & Pop Jazz Bass octave groove
              const slapSteps: [number, number, number][] = [
                [0, 36, 126],
                [2, 48, 124],
                [3, 36, 112],
                [6, 39, 122],
                [8, 41, 125],
                [10, 53, 124],
                [12, 43, 120],
                [14, 55, 124],
                [16, 36, 126],
                [18, 48, 124],
                [20, 39, 118],
                [22, 41, 122],
                [24, 43, 125],
                [26, 55, 126],
                [28, 46, 120],
                [30, 43, 118],
              ];
              slapSteps.forEach(([s, n, v]) => pushNote(s, n, 0.35, 'slap-bass', v));
              // Funk synth stabs
              [4, 12, 20, 28].forEach((s) => {
                pushNote(s, 63, 0.35, 'synth', 108);
                pushNote(s, 67, 0.35, 'synth', 108);
              });
            } else if (presetId === 'trap') {
              setBpm(136);
              selectProgram(1);
              setStepGrid({ A: createEmptyGrid(), B: createEmptyGrid() });
              [0, 7, 10, 16, 23, 26].forEach((s) => pushPad(s, 0, 127));
              [8, 24].forEach((s) => pushPad(s, 1, 126));
              for (let s = 0; s < 32; s++) pushPad(s, 2, s % 2 === 0 ? 116 : 94);
              // Fretless Mwah Sub Glide Bass
              pushNote(0, 36, 1.5, 'fretless-bass', 125);
              pushNote(7, 36, 0.75, 'fretless-bass', 122);
              pushNote(10, 39, 1.25, 'fretless-bass', 120);
              pushNote(16, 36, 1.5, 'fretless-bass', 125);
              pushNote(23, 41, 0.75, 'fretless-bass', 122);
              pushNote(26, 38, 1.25, 'fretless-bass', 120);
              // Dark minor bell arps
              [0, 3, 6, 12, 16, 19, 22, 28].forEach((s, i) => {
                const bellNotes = [60, 67, 63, 62, 60, 68, 67, 62];
                pushNote(s, bellNotes[i % bellNotes.length], 0.5, 'synth', 104);
              });
            } else {
              // Synthwave + Picked Bass
              setBpm(116);
              selectProgram(2);
              setStepGrid({ A: createEmptyGrid(), B: createEmptyGrid() });
              [0, 8, 16, 24].forEach((s) => pushPad(s, 0, 124));
              [4, 12, 20, 28].forEach((s) => pushPad(s, 1, 124));
              for (let s = 0; s < 32; s += 2) pushPad(s, 2, 104);
              // Driving 8th-note Picked Rock Bass
              for (let s = 0; s < 32; s += 2) {
                const root = s < 8 ? 36 : s < 16 ? 43 : s < 24 ? 41 : 39;
                pushNote(s, root, 0.35, 'picked-bass', s % 4 === 0 ? 122 : 108);
              }
              // Synthwave lead hook
              const hook: [number, number][] = [
                [0, 67],
                [4, 72],
                [6, 70],
                [8, 67],
                [12, 63],
                [16, 65],
                [20, 67],
                [24, 62],
                [28, 63],
              ];
              hook.forEach(([s, n]) => pushNote(s, n, 0.75, 'synth', 112));
            }

            setRecordedEvents(events);
            setMutedTracks({ drums: false, bass: false, synth: false });
            setDemoPlaying(true);
            setLcdStatus(`LOADED MULTI-TRACK BEAT: ${presetId.toUpperCase()}`);
          }}
          onExportMidi={handleExportMidi}
          onStatusUpdate={setLcdStatus}
        />

        {/* 16-Step Visual MPC Drum Grid Sequencer */}
        <StepSequencer16
          program={program}
          padBank={padBank}
          customPadLabels={customPadLabels}
          stepGrid={stepGrid}
          mutedPads={mutedPads}
          currentStep16={currentStep16}
          sequencerPlaying={demoPlaying}
          onTogglePlay={() => {
            setDemoPlaying((prev) => {
              const next = !prev;
              setLcdStatus(next ? 'STEP SEQUENCER: PLAYING' : 'STEP SEQUENCER: STOPPED');
              return next;
            });
          }}
          onStepChange={(bank, padIdx, stepIdx, nextVal) => {
            setStepGrid((prev) => {
              const nextBankGrid = prev[bank].map((row, rIdx) =>
                rIdx === padIdx
                  ? row.map((v, sIdx) => (sIdx === stepIdx ? nextVal : v))
                  : row
              );
              return { ...prev, [bank]: nextBankGrid };
            });
            setLcdStatus(
              `SEQ PAD ${padIdx + 1} [${bank}] · STEP ${stepIdx + 1}: ${
                nextVal === 2 ? 'ACCENT (127)' : nextVal === 1 ? 'ON (105)' : 'OFF'
              }`
            );
          }}
          onToggleMutePad={(bank, padIdx) => {
            setMutedPads((prev) => {
              const nextMutes = prev[bank].map((m, i) => (i === padIdx ? !m : m));
              setLcdStatus(
                `PAD ${padIdx + 1} [${bank}]: ${nextMutes[padIdx] ? 'MUTED' : 'UNMUTED'}`
              );
              return { ...prev, [bank]: nextMutes };
            });
          }}
          onLoadPresetPattern={(progId) => {
            setStepGrid((prev) => ({
              ...prev,
              A: createPresetGridForProgram(progId),
            }));
            setPadBank('A');
            setLcdStatus(`LOADED PROG ${progId} 16-STEP PATTERN`);
          }}
          onRandomizeBank={(bank) => {
            setStepGrid((prev) => {
              const randGrid = createEmptyGrid().map((row, padIdx) =>
                row.map((_, sIdx) => {
                  // Musical probabilities by drum voice role
                  if (padIdx === 0) return sIdx === 0 || sIdx === 8 ? 2 : Math.random() < 0.2 ? 1 : 0;
                  if (padIdx === 1) return sIdx === 4 || sIdx === 12 ? 2 : Math.random() < 0.1 ? 1 : 0;
                  if (padIdx === 2) return Math.random() < 0.55 ? (sIdx % 4 === 0 ? 2 : 1) : 0;
                  return Math.random() < 0.14 ? (Math.random() < 0.3 ? 2 : 1) : 0;
                })
              );
              return { ...prev, [bank]: randGrid };
            });
            setLcdStatus(`RANDOMIZED 16-STEP GROOVE [BANK ${bank}]`);
          }}
          onClearBank={(bank) => {
            setStepGrid((prev) => ({ ...prev, [bank]: createEmptyGrid() }));
            setLcdStatus(`CLEARED 16-STEP GRID [BANK ${bank}]`);
          }}
          onAuditionPad={(padIdx) => {
            handlePadDown(padIdx, 118);
            setTimeout(() => handlePadUp(padIdx), 120);
          }}
          onBankSwitch={(bank) => {
            setPadBank(bank);
            setLcdStatus(`PAD BANK ${bank} SELECTED`);
          }}
        />

        {/* Cloud User Patch & Knob Bank Library */}
        <CloudPatchBank
          program={program}
          knobs={knobs}
          bpm={bpm}
          timeDivision={timeDivision}
          arpMode={arpMode}
          arpOctaves={arpOctaves}
          swing={swing}
          onLoadPatch={(patch: CloudSynthPatch) => {
            const foundProg =
              PROGRAM_PRESETS.find((p) => p.id === patch.programId) || PROGRAM_PRESETS[0];
            const loadedKnobs: KnobParameters = {
              k1Cutoff: patch.k1Cutoff,
              k2Resonance: patch.k2Resonance,
              k3Attack: patch.k3Attack,
              k4Release: patch.k4Release,
              k5Detune: patch.k5Detune,
              k6SubMix: patch.k6SubMix,
              k7DelayMix: patch.k7DelayMix,
              k8ReverbMix: patch.k8ReverbMix,
            };
            setProgram(foundProg);
            setKnobs(loadedKnobs);
            setBpm(patch.bpm);
            setTimeDivision(patch.timeDivision);
            setArpMode(patch.arpMode);
            setArpOctaves(patch.arpOctaves);
            setSwing(patch.swing);
            soundEngine.setProgram(foundProg);
            soundEngine.updateKnobs(loadedKnobs);
            setLcdStatus(`LOADED PATCH: ${patch.name.toUpperCase()}`);
          }}
          onStatusUpdate={setLcdStatus}
        />
      </main>
    </div>
  );
}
