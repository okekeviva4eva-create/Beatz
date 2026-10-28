import React, { useState } from 'react';
import {
  Play,
  Square,
  Circle,
  Volume2,
  VolumeX,
  Trash2,
  Download,
  Sparkles,
  Radio,
  Bell,
  Grid,
  RotateCcw,
  Layers,
  Repeat,
  Guitar,
} from 'lucide-react';
import {
  KEYBOARD_VOICE_OPTIONS,
  KeyboardVoiceMode,
  ProgramPreset,
  soundEngine,
} from '../audio/soundEngine';

export interface BeatRecordedEvent {
  id: string;
  beatOffset: number; // 0..8 beats (2 bars of 4/4)
  type: 'pad' | 'note';
  index: number; // padIndex (0..7) or midiNote
  bank?: 'A' | 'B';
  velocity: number;
  durationBeats?: number;
  voiceMode?: KeyboardVoiceMode;
}

export interface RecordedAudioTake {
  id: string;
  title: string;
  url: string;
  mimeType: string;
  durationSec: number;
  bpm: number;
  createdAt: string;
}

interface BeatStudioRecorderProps {
  program: ProgramPreset;
  padBank: 'A' | 'B';
  bpm: number;
  keyboardVoice: KeyboardVoiceMode;
  loopPlaying: boolean;
  loopRecording: boolean;
  liveLatchMode: boolean;
  autoQuantize: boolean;
  metronomeOn: boolean;
  currentLoopBeat: number; // 0..8
  recordedEvents: BeatRecordedEvent[];
  mutedTracks: { drums: boolean; bass: boolean; synth: boolean };
  loopingPads: Set<number>;
  onTogglePlay: () => void;
  onToggleRecord: () => void;
  onToggleLiveLatchMode: () => void;
  onTogglePadLoop: (padIndex: number) => void;
  onJoinBassGroove: (bassVoice: KeyboardVoiceMode, rootMidi?: number) => void;
  onToggleQuantize: () => void;
  onToggleMetronome: () => void;
  onSelectKeyboardVoice: (voice: KeyboardVoiceMode) => void;
  onToggleMuteTrack: (track: 'drums' | 'bass' | 'synth') => void;
  onClearTrack: (track: 'drums' | 'bass' | 'synth' | 'all') => void;
  onDeleteEvent: (id: string) => void;
  onAddQuickEvent: (ev: BeatRecordedEvent) => void;
  onUndoLastEvent: () => void;
  onLoadStarterBeat: (presetId: 'boombap' | 'trap' | 'funk-slap' | 'synthwave') => void;
  onExportMidi: () => void;
  onStatusUpdate: (msg: string) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function formatMidiNote(midi: number, isBass = false): string {
  const effectiveMidi = isBass ? midi - 12 : midi;
  const name = NOTE_NAMES[((effectiveMidi % 12) + 12) % 12];
  const oct = Math.floor(effectiveMidi / 12) - 1;
  return `${name}${oct}`;
}

export const BeatStudioRecorder: React.FC<BeatStudioRecorderProps> = ({
  program,
  padBank,
  bpm,
  keyboardVoice,
  loopPlaying,
  loopRecording,
  liveLatchMode,
  autoQuantize,
  metronomeOn,
  currentLoopBeat,
  recordedEvents,
  mutedTracks,
  loopingPads,
  onTogglePlay,
  onToggleRecord,
  onToggleLiveLatchMode,
  onTogglePadLoop,
  onJoinBassGroove,
  onToggleQuantize,
  onToggleMetronome,
  onSelectKeyboardVoice,
  onToggleMuteTrack,
  onClearTrack,
  onDeleteEvent,
  onAddQuickEvent,
  onUndoLastEvent,
  onLoadStarterBeat,
  onExportMidi,
  onStatusUpdate,
}) => {
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [audioTakes, setAudioTakes] = useState<RecordedAudioTake[]>([]);
  const [quickBassNote, setQuickBassNote] = useState<number>(48); // C3 (sounds as C2 in Bass mode)
  const [quickSynthNote, setQuickSynthNote] = useState<number>(60); // C4

  const drumEvents = recordedEvents.filter((e) => e.type === 'pad');
  const bassEvents = recordedEvents.filter(
    (e) => e.type === 'note' && e.voiceMode && e.voiceMode !== 'synth'
  );
  const synthEvents = recordedEvents.filter(
    (e) => e.type === 'note' && (!e.voiceMode || e.voiceMode === 'synth')
  );

  const activeBassVoiceInLoop = bassEvents[0]?.voiceMode;
  const playheadPercent = Math.max(0, Math.min(100, (currentLoopBeat / 8) * 100));

  const handleToggleMasterAudioRecord = async () => {
    if (!isAudioRecording) {
      const started = soundEngine.startMasterAudioRecording();
      if (started) {
        setIsAudioRecording(true);
        if (!loopPlaying) {
          onTogglePlay();
        }
        onStatusUpdate('MASTER AUDIO RECORDER: CAPTURING LIVE OUTPUT');
      } else {
        onStatusUpdate('AUDIO RECORDING NOT SUPPORTED IN THIS BROWSER');
      }
    } else {
      setIsAudioRecording(false);
      const result = await soundEngine.stopMasterAudioRecording();
      if (result) {
        const takeNum = audioTakes.length + 1;
        const newTake: RecordedAudioTake = {
          id: `${Date.now()}`,
          title: `Beat Session Take #${takeNum} (${program.name})`,
          url: result.url,
          mimeType: result.mimeType,
          durationSec: Number(result.durationSec.toFixed(1)),
          bpm,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setAudioTakes((prev) => [newTake, ...prev]);
        onStatusUpdate(`SAVED AUDIO TAKE #${takeNum} (${newTake.durationSec}s)`);
      }
    }
  };

  return (
    <section className="w-full bg-[#16181d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-xl flex flex-col gap-4 select-none">
      {/* Top Header & Beat Maker Transport Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600/15 border border-red-500/40 text-red-400 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold text-white tracking-tight">
                Multi-Track Beat Maker &amp; Live Pad/Bass Looper
              </h2>
              <span className="text-xs font-mono-tabular text-zinc-400">
                · 2 Bars (8 Beats) · {recordedEvents.length} Events
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Click any MPC Pad to start it looping continuously, then click any Bass Guitar or key so it immediately joins the play.
            </p>
          </div>
        </div>

        {/* Transport & Recording Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Pad & Bass Latch Toggle */}
          <button
            type="button"
            onClick={onToggleLiveLatchMode}
            data-hw-title="LIVE PAD & BASS AUTO-LOOP LATCH"
            data-hw-func="When ON, clicking any MPC Drum Pad keeps that pad sound playing in a continuous rhythm loop, and selecting or playing a Bass Guitar immediately joins the playing beat."
            data-hw-state={liveLatchMode ? 'AUTO-LOOP LATCH: ON' : 'ONE-SHOT MODE'}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
              liveLatchMode
                ? 'bg-emerald-600/25 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5 text-emerald-400" />
            <span>Click Pad/Bass to Loop: {liveLatchMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Play / Stop Beat Loop */}
          <button
            type="button"
            onClick={onTogglePlay}
            data-hw-title={loopPlaying ? 'STOP BEAT PLAYBACK' : 'PLAY MULTI-TRACK BEAT'}
            data-hw-func="Starts or stops playback of your 2-bar multi-track beat (Drums, Bass Guitar, and Synth)."
            data-hw-state={loopPlaying ? `PLAYING AT ${bpm} BPM` : 'STOPPED'}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              loopPlaying
                ? 'bg-zinc-100 text-zinc-900 shadow-[0_0_12px_rgba(255,255,255,0.25)]'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
            }`}
          >
            {loopPlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Beat</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Beat</span>
              </>
            )}
          </button>

          {/* Record Overdub Toggle */}
          <button
            type="button"
            onClick={onToggleRecord}
            data-hw-title={loopRecording ? 'STOP OVERDUB RECORDING' : 'ARM BEAT OVERDUB RECORDING'}
            data-hw-func="Records every MPC drum pad, Bass Guitar note, and Synth chord you play onto the 2-bar multi-track timeline."
            data-hw-state={loopRecording ? 'OVERDUBBING LIVE' : 'READY TO RECORD'}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              loopRecording
                ? 'bg-red-600 text-white shadow-[0_0_16px_rgba(239,68,68,0.65)]'
                : 'bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40'
            }`}
          >
            <Circle className="w-3.5 h-3.5 fill-current" />
            <span>{loopRecording ? 'Recording Overdub...' : 'Record Beat Overdub'}</span>
          </button>

          {/* Metronome Click Track Toggle */}
          <button
            type="button"
            onClick={onToggleMetronome}
            data-hw-title="STUDIO METRONOME CLICK"
            data-hw-func="Plays a quarter-note reference click track (accented on beat 1) so you can record drums, bass, and keys in time."
            data-hw-state={metronomeOn ? 'CLICK: ON' : 'CLICK: OFF'}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
              metronomeOn
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-800/90 border-zinc-700/80 text-zinc-300 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Click: {metronomeOn ? 'ON' : 'OFF'}</span>
          </button>

          {/* Auto-Quantize 1/16 Toggle */}
          <button
            type="button"
            onClick={onToggleQuantize}
            data-hw-title="1/16 GRID AUTO-QUANTIZE"
            data-hw-func="Snaps recorded drum, bass guitar, and synth notes to the nearest 1/16th-note step for tight timing."
            data-hw-state={autoQuantize ? '1/16 SNAP: ON' : 'OFF'}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
              autoQuantize
                ? 'bg-red-600/20 border-red-500/50 text-red-300'
                : 'bg-zinc-800/90 border-zinc-700/80 text-zinc-400 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>1/16 Quantize: {autoQuantize ? 'ON' : 'OFF'}</span>
          </button>

          {/* Live Master Audio Capture Button */}
          <button
            type="button"
            onClick={handleToggleMasterAudioRecord}
            data-hw-title={isAudioRecording ? 'STOP & SAVE AUDIO TAKE' : 'CAPTURE LIVE MASTER AUDIO'}
            data-hw-func="Records the master stereo audio output of the studio into a downloadable audio file (.webm)."
            data-hw-state={isAudioRecording ? 'RECORDING AUDIO' : `${audioTakes.length} TAKES SAVED`}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
              isAudioRecording
                ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_14px_rgba(16,185,129,0.6)]'
                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-emerald-400'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isAudioRecording ? 'Stop Audio Capture' : 'Capture Audio'}</span>
          </button>

          {/* Export MIDI Button */}
          <button
            type="button"
            onClick={onExportMidi}
            data-hw-title="EXPORT BEAT AS MIDI (.MID)"
            data-hw-func="Downloads your multi-track beat (Drums, Bass Guitar, and Synth) as a Standard MIDI File (.mid)."
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-100 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-red-400" />
            <span>Export .MID</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* LIVE LOOP STATUS STRIP (References Hardware Pads & Key Voice Above)   */}
      {/* ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#101217] border border-zinc-800/90 rounded-lg px-3.5 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono-tabular font-bold uppercase tracking-wider text-zinc-400">
            Active Pad Loops [Bank {padBank}]:
          </span>
          {loopingPads.size === 0 ? (
            <span className="text-zinc-500">
              None — click any <strong className="text-zinc-300">MPC Pad (1–8)</strong> on the controller above to loop its sound
            </span>
          ) : (
            Array.from(loopingPads)
              .sort((a, b) => a - b)
              .map((padIdx) => {
                const padName =
                  padBank === 'A' ? program.padNamesA[padIdx] : program.padNamesB[padIdx];
                return (
                  <button
                    key={padIdx}
                    type="button"
                    onClick={() => onTogglePadLoop(padIdx)}
                    data-hw-title={`STOP PAD ${padIdx + 1} LOOP`}
                    data-hw-func={`Stops PAD ${padIdx + 1} (${padName}) from looping in the beat.`}
                    className="px-2 py-0.5 rounded bg-red-600/25 border border-red-500/70 text-red-200 font-mono-tabular font-bold text-[11px] flex items-center gap-1.5 hover:bg-red-600/40 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                    <span>
                      PAD {padIdx + 1}: {padName} ×
                    </span>
                  </button>
                );
              })
          )}
        </div>

        <div className="flex items-center gap-2 font-mono-tabular">
          <Guitar className="w-3.5 h-3.5 text-amber-400" />
          <span className="uppercase tracking-wider text-zinc-400 font-bold">Bass Line:</span>
          {bassEvents.length > 0 ? (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold text-[11px]">
              {activeBassVoiceInLoop?.toUpperCase()} JOINED ({bassEvents.length} notes)
            </span>
          ) : (
            <span className="text-zinc-500">
              Select a <strong className="text-amber-300">Bass Guitar</strong> in <strong className="text-zinc-300">KEY VOICE</strong> above to join the beat
            </span>
          )}
        </div>
      </div>

      {/* One-Click "Create Beat" Starter Templates & Quick Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111318] border border-zinc-800/80 rounded-lg px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono-tabular font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-red-400" />
            Full Beat Combos:
          </span>

          <button
            type="button"
            onClick={() => onLoadStarterBeat('boombap')}
            data-hw-title="CREATE 90S BOOM-BAP BEAT"
            data-hw-func="Generates a full 2-bar Hip-Hop beat with SP-1200 Drums, a Fingered P-Bass guitar line, and Neo-Soul Rhodes chords."
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-600/25 hover:border-red-500/50 border border-zinc-700/80 text-xs font-semibold text-zinc-200 transition-all cursor-pointer"
          >
            + Boom-Bap + P-Bass Beat
          </button>

          <button
            type="button"
            onClick={() => onLoadStarterBeat('funk-slap')}
            data-hw-title="CREATE FUNK SLAP BASS BEAT"
            data-hw-func="Generates a syncopated Funk groove featuring Slap & Pop Jazz Bass guitar octaves, pocket drums, and synth stabs."
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-600/25 hover:border-red-500/50 border border-zinc-700/80 text-xs font-semibold text-zinc-200 transition-all cursor-pointer"
          >
            + Funk Slap Bass Jam
          </button>

          <button
            type="button"
            onClick={() => onLoadStarterBeat('trap')}
            data-hw-title="CREATE 808 TRAP BEAT"
            data-hw-func="Generates a dark 808 Trap beat with rolling hi-hats, heavy sub-bass glides, and minor bell arpeggios."
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-600/25 hover:border-red-500/50 border border-zinc-700/80 text-xs font-semibold text-zinc-200 transition-all cursor-pointer"
          >
            + 808 Trap Banger
          </button>

          <button
            type="button"
            onClick={() => onLoadStarterBeat('synthwave')}
            data-hw-title="CREATE 80S SYNTHWAVE BEAT"
            data-hw-func="Generates an 80s Synthwave groove with LinnDrum snares, driving Picked Rock Bass guitar, and lush analog poly chords."
            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-red-600/25 hover:border-red-500/50 border border-zinc-700/80 text-xs font-semibold text-zinc-200 transition-all cursor-pointer"
          >
            + Synthwave + Picked Bass
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {(recordedEvents.length > 0 || loopingPads.size > 0) && (
            <>
              <button
                type="button"
                onClick={onUndoLastEvent}
                data-hw-title="UNDO LAST RECORDED NOTE"
                data-hw-func="Removes the most recently recorded or added note/pad event from the beat timeline."
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={() => onClearTrack('all')}
                data-hw-title="CLEAR ENTIRE BEAT TIMELINE"
                data-hw-func="Clears all looping pads and recorded events across Drums, Bass Guitar, and Synth tracks."
                className="px-2 py-1 rounded bg-zinc-800/80 hover:bg-red-950/70 text-xs font-medium text-zinc-300 hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3-Track Visual Beat Timeline (2 Bars = 8 Quarter-Note Beats = 32 Sixteenth-Note Steps) */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[780px] flex flex-col gap-2">
          {/* Timeline Ruler (Bar 1: Beats 1..4 | Bar 2: Beats 5..8) */}
          <div className="grid grid-cols-[200px_1fr] gap-3 items-center px-1">
            <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-zinc-400 font-semibold">
              TRACK / INSTRUMENT
            </div>
            <div className="relative grid grid-cols-8 gap-1">
              {Array.from({ length: 8 }, (_, beatIdx) => {
                const barNum = Math.floor(beatIdx / 4) + 1;
                const beatInBar = (beatIdx % 4) + 1;
                return (
                  <div
                    key={beatIdx}
                    className={`px-2 py-1 rounded text-[10px] font-mono-tabular font-bold flex items-center justify-between ${
                      beatIdx % 4 === 0
                        ? 'bg-zinc-800/90 text-zinc-200 border border-zinc-700/70'
                        : 'bg-[#101216] text-zinc-400 border border-zinc-800/60'
                    }`}
                  >
                    <span>
                      BAR {barNum}.{beatInBar}
                    </span>
                    <span className="text-[8.5px] text-zinc-500">Beat {beatIdx + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================================================================= */}
          {/* TRACK 1: MPC DRUM PADS LANE                                       */}
          {/* ================================================================= */}
          <div
            className={`grid grid-cols-[200px_1fr] gap-3 items-center p-2 rounded-lg border transition-colors ${
              mutedTracks.drums
                ? 'opacity-50 bg-[#0d0e12] border-zinc-800/50'
                : 'bg-[#111318] border-zinc-800/90'
            }`}
          >
            {/* Track 1 Controls */}
            <div className="flex flex-col gap-1 pr-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  1. MPC DRUMS
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleMuteTrack('drums')}
                    data-hw-title="MUTE / UNMUTE DRUM TRACK"
                    data-hw-func="Mutes or unmutes recorded MPC drum hits in the 2-bar beat loop."
                    className={`p-1 rounded cursor-pointer ${
                      mutedTracks.drums ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {mutedTracks.drums ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onClearTrack('drums')}
                    data-hw-title="CLEAR DRUM TRACK"
                    data-hw-func="Removes all recorded MPC pad hits from Track 1."
                    className="p-1 rounded text-zinc-500 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <span className="text-[10px] font-mono-tabular text-zinc-400">
                {drumEvents.length} Hits · Click Pad or grid to loop
              </span>
            </div>

            {/* Track 1 Timeline Canvas (32 Sixteenth-Note Slots) */}
            <div className="relative h-12 bg-[#0b0d11] rounded-md border border-zinc-800 overflow-hidden">
              {/* 32 clickable 1/16th background grid cells */}
              <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(0,1fr))]">
                {Array.from({ length: 32 }, (_, step32) => {
                  const isBarStart = step32 % 16 === 0;
                  const isBeatStart = step32 % 4 === 0;
                  const beatPos = step32 * 0.25;
                  return (
                    <button
                      key={step32}
                      type="button"
                      data-hw-title={`DRUM TIMELINE · STEP ${step32 + 1}/32`}
                      data-hw-func="Click to insert an MPC Kick/Snare drum hit at this 1/16th-note position."
                      onClick={() => {
                        const padIdx = step32 % 8 === 4 ? 1 : 0;
                        soundEngine.triggerPad(padIdx, padBank, 115);
                        onAddQuickEvent({
                          id: `manual-drum-${Date.now()}-${Math.random()}`,
                          beatOffset: beatPos,
                          type: 'pad',
                          index: padIdx,
                          bank: padBank,
                          velocity: 115,
                          durationBeats: 0.25,
                        });
                      }}
                      className={`h-full border-r transition-colors cursor-pointer ${
                        isBarStart
                          ? 'border-zinc-700/80 bg-zinc-900/30'
                          : isBeatStart
                          ? 'border-zinc-800/90 bg-zinc-900/15'
                          : 'border-zinc-900/80 hover:bg-red-500/15'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Rendered Drum Events */}
              {drumEvents.map((ev) => {
                const leftPct = ((ev.beatOffset % 8) / 8) * 100;
                const padName =
                  ev.bank === 'B'
                    ? program.padNamesB[ev.index]
                    : program.padNamesA[ev.index];
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEvent(ev.id);
                    }}
                    data-hw-title={`DRUM HIT: PAD ${ev.index + 1} (${padName.toUpperCase()})`}
                    data-hw-func="Click this recorded drum event to delete it from the timeline."
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-1.5 bottom-1.5 min-w-[18px] px-1 rounded bg-red-600 hover:bg-red-500 border border-red-300 text-[8.5px] font-mono-tabular font-bold text-white flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10 cursor-pointer"
                  >
                    P{ev.index + 1}
                  </button>
                );
              })}

              {/* Moving Playhead */}
              <div
                style={{ left: `${playheadPercent}%` }}
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_8px_#ffffff] z-20 pointer-events-none"
              />
            </div>
          </div>

          {/* ================================================================= */}
          {/* TRACK 2: ELECTRIC BASS GUITAR LANE                                */}
          {/* ================================================================= */}
          <div
            className={`grid grid-cols-[200px_1fr] gap-3 items-center p-2 rounded-lg border transition-colors ${
              mutedTracks.bass
                ? 'opacity-50 bg-[#0d0e12] border-zinc-800/50'
                : 'bg-[#111318] border-zinc-800/90'
            }`}
          >
            {/* Track 2 Controls */}
            <div className="flex flex-col gap-1 pr-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  2. BASS GUITAR
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectKeyboardVoice(
                        keyboardVoice === 'synth' ? 'finger-bass' : keyboardVoice
                      )
                    }
                    data-hw-title="ARM BASS GUITAR ON KEYBOARD"
                    data-hw-func="Switches the 25-key keyboard to Electric Bass Guitar so you can play or record basslines."
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono-tabular font-bold cursor-pointer ${
                      keyboardVoice !== 'synth'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {keyboardVoice !== 'synth' ? 'ARMED' : 'ARM'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleMuteTrack('bass')}
                    data-hw-title="MUTE / UNMUTE BASS GUITAR TRACK"
                    data-hw-func="Mutes or unmutes all recorded Electric Bass Guitar notes."
                    className={`p-1 rounded cursor-pointer ${
                      mutedTracks.bass ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {mutedTracks.bass ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onClearTrack('bass')}
                    data-hw-title="CLEAR BASS GUITAR TRACK"
                    data-hw-func="Removes all recorded Bass Guitar notes from Track 2."
                    className="p-1 rounded text-zinc-500 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Root Note Picker for Click-to-Insert Bass Notes */}
              <div className="flex items-center justify-between text-[10px] font-mono-tabular text-zinc-400">
                <span>{bassEvents.length} Notes</span>
                <div className="flex items-center gap-1">
                  <span>Root:</span>
                  {[48, 51, 53, 55].map((midi) => (
                    <button
                      key={midi}
                      type="button"
                      onClick={() => setQuickBassNote(midi)}
                      className={`px-1 rounded text-[9px] font-bold cursor-pointer ${
                        quickBassNote === midi
                          ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {formatMidiNote(midi, true)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Track 2 Timeline Canvas (32 Sixteenth-Note Slots) */}
            <div className="relative h-12 bg-[#0b0d11] rounded-md border border-zinc-800 overflow-hidden">
              <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(0,1fr))]">
                {Array.from({ length: 32 }, (_, step32) => {
                  const isBeatStart = step32 % 4 === 0;
                  const beatPos = step32 * 0.25;
                  return (
                    <button
                      key={step32}
                      type="button"
                      data-hw-title={`BASS TIMELINE · STEP ${step32 + 1}/32`}
                      data-hw-func={`Click to insert a ${formatMidiNote(
                        quickBassNote,
                        true
                      )} Bass Guitar note at this 1/16th step.`}
                      onClick={() => {
                        const activeBassVoice: KeyboardVoiceMode =
                          keyboardVoice !== 'synth' ? keyboardVoice : 'finger-bass';
                        soundEngine.noteOn(quickBassNote, 115, activeBassVoice);
                        setTimeout(() => soundEngine.noteOff(quickBassNote), 180);
                        onAddQuickEvent({
                          id: `manual-bass-${Date.now()}-${Math.random()}`,
                          beatOffset: beatPos,
                          type: 'note',
                          index: quickBassNote,
                          velocity: 115,
                          durationBeats: 0.5,
                          voiceMode: activeBassVoice,
                        });
                      }}
                      className={`h-full border-r transition-colors cursor-pointer ${
                        isBeatStart
                          ? 'border-zinc-800/90 bg-zinc-900/15'
                          : 'border-zinc-900/80 hover:bg-amber-500/15'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Rendered Bass Guitar Note Blocks */}
              {bassEvents.map((ev) => {
                const leftPct = ((ev.beatOffset % 8) / 8) * 100;
                const widthPct = Math.max(
                  3.1,
                  Math.min(100 - leftPct, ((ev.durationBeats || 0.5) / 8) * 100)
                );
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEvent(ev.id);
                    }}
                    data-hw-title={`BASS NOTE: ${formatMidiNote(ev.index, true)} (${ev.voiceMode?.toUpperCase()})`}
                    data-hw-func="Click this recorded Bass Guitar note to delete it from the timeline."
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    className="absolute top-1.5 bottom-1.5 px-1 rounded bg-amber-500 hover:bg-amber-400 border border-amber-200 text-[8.5px] font-mono-tabular font-extrabold text-zinc-950 flex items-center justify-center shadow-[0_0_8px_rgba(245,158,11,0.5)] z-10 cursor-pointer truncate"
                  >
                    {formatMidiNote(ev.index, true)}
                  </button>
                );
              })}

              {/* Moving Playhead */}
              <div
                style={{ left: `${playheadPercent}%` }}
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_8px_#ffffff] z-20 pointer-events-none"
              />
            </div>
          </div>

          {/* ================================================================= */}
          {/* TRACK 3: POLY SYNTH & KEYS LANE                                   */}
          {/* ================================================================= */}
          <div
            className={`grid grid-cols-[200px_1fr] gap-3 items-center p-2 rounded-lg border transition-colors ${
              mutedTracks.synth
                ? 'opacity-50 bg-[#0d0e12] border-zinc-800/50'
                : 'bg-[#111318] border-zinc-800/90'
            }`}
          >
            {/* Track 3 Controls */}
            <div className="flex flex-col gap-1 pr-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  3. SYNTH / KEYS
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectKeyboardVoice('synth')}
                    data-hw-title="ARM POLY SYNTH ON KEYBOARD"
                    data-hw-func="Switches the 25-key keyboard to the Program Polyphonic Synthesizer voice."
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono-tabular font-bold cursor-pointer ${
                      keyboardVoice === 'synth'
                        ? 'bg-sky-400 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {keyboardVoice === 'synth' ? 'ARMED' : 'ARM'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleMuteTrack('synth')}
                    data-hw-title="MUTE / UNMUTE SYNTH TRACK"
                    data-hw-func="Mutes or unmutes all recorded Synthesizer notes and chords."
                    className={`p-1 rounded cursor-pointer ${
                      mutedTracks.synth ? 'bg-red-900/50 text-red-300' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {mutedTracks.synth ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onClearTrack('synth')}
                    data-hw-title="CLEAR SYNTH TRACK"
                    data-hw-func="Removes all recorded Synthesizer notes from Track 3."
                    className="p-1 rounded text-zinc-500 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Note Picker for Click-to-Insert Synth Notes */}
              <div className="flex items-center justify-between text-[10px] font-mono-tabular text-zinc-400">
                <span>{synthEvents.length} Notes</span>
                <div className="flex items-center gap-1">
                  <span>Insert:</span>
                  {[60, 63, 65, 67].map((midi) => (
                    <button
                      key={midi}
                      type="button"
                      onClick={() => setQuickSynthNote(midi)}
                      className={`px-1 rounded text-[9px] font-bold cursor-pointer ${
                        quickSynthNote === midi
                          ? 'bg-sky-500/30 text-sky-300 border border-sky-500/50'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {formatMidiNote(midi, false)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Track 3 Timeline Canvas (32 Sixteenth-Note Slots) */}
            <div className="relative h-12 bg-[#0b0d11] rounded-md border border-zinc-800 overflow-hidden">
              <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(0,1fr))]">
                {Array.from({ length: 32 }, (_, step32) => {
                  const isBeatStart = step32 % 4 === 0;
                  const beatPos = step32 * 0.25;
                  return (
                    <button
                      key={step32}
                      type="button"
                      data-hw-title={`SYNTH TIMELINE · STEP ${step32 + 1}/32`}
                      data-hw-func={`Click to insert a ${formatMidiNote(
                        quickSynthNote,
                        false
                      )} Synth note at this 1/16th step.`}
                      onClick={() => {
                        soundEngine.noteOn(quickSynthNote, 105, 'synth');
                        setTimeout(() => soundEngine.noteOff(quickSynthNote), 220);
                        onAddQuickEvent({
                          id: `manual-synth-${Date.now()}-${Math.random()}`,
                          beatOffset: beatPos,
                          type: 'note',
                          index: quickSynthNote,
                          velocity: 105,
                          durationBeats: 0.75,
                          voiceMode: 'synth',
                        });
                      }}
                      className={`h-full border-r transition-colors cursor-pointer ${
                        isBeatStart
                          ? 'border-zinc-800/90 bg-zinc-900/15'
                          : 'border-zinc-900/80 hover:bg-sky-500/15'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Rendered Synth Note Blocks */}
              {synthEvents.map((ev) => {
                const leftPct = ((ev.beatOffset % 8) / 8) * 100;
                const widthPct = Math.max(
                  3.1,
                  Math.min(100 - leftPct, ((ev.durationBeats || 0.5) / 8) * 100)
                );
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEvent(ev.id);
                    }}
                    data-hw-title={`SYNTH NOTE: ${formatMidiNote(ev.index, false)}`}
                    data-hw-func="Click this recorded Synth note to delete it from the timeline."
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    className="absolute top-1.5 bottom-1.5 px-1 rounded bg-sky-500 hover:bg-sky-400 border border-sky-200 text-[8.5px] font-mono-tabular font-extrabold text-zinc-950 flex items-center justify-center shadow-[0_0_8px_rgba(14,165,233,0.5)] z-10 cursor-pointer truncate"
                  >
                    {formatMidiNote(ev.index, false)}
                  </button>
                );
              })}

              {/* Moving Playhead */}
              <div
                style={{ left: `${playheadPercent}%` }}
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_8px_#ffffff] z-20 pointer-events-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recorded Master Audio Takes Drawer (Appears when user records live audio takes) */}
      {audioTakes.length > 0 && (
        <div className="border-t border-zinc-800/80 pt-3 flex flex-col gap-2">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono-tabular">
            Captured Master Audio Beats ({audioTakes.length})
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {audioTakes.map((take) => (
              <div
                key={take.id}
                className="bg-[#101216] border border-zinc-800 rounded-lg p-2.5 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-white">{take.title}</div>
                    <div className="text-[10px] font-mono-tabular text-zinc-400">
                      {take.durationSec}s · {take.bpm} BPM · Recorded at {take.createdAt}
                    </div>
                  </div>
                  <a
                    href={take.url}
                    download={`${take.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webm`}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Audio</span>
                  </a>
                </div>
                <audio controls src={take.url} className="w-full h-8" />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
