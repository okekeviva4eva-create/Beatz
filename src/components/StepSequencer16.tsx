import React, { useState } from 'react';
import {
  Play,
  Square,
  Trash2,
  Shuffle,
  Volume2,
  VolumeX,
  Grid,
  Sparkles,
} from 'lucide-react';
import { ProgramPreset } from '../audio/soundEngine';

// 8 pads x 16 steps: 0 = Off, 1 = Normal (vel 105), 2 = Accent (vel 127)
export type StepGridState = Record<'A' | 'B', number[][]>;

export function createEmptyGrid(): number[][] {
  return Array.from({ length: 8 }, () => Array(16).fill(0));
}

export function createPresetGridForProgram(progId: number): number[][] {
  const grid = createEmptyGrid();
  if (progId === 1) {
    // Boom-Bap Groove
    // PAD 1 Kick: 0, 6, 8, 14
    [0, 6, 8, 14].forEach((s) => (grid[0][s] = s === 0 || s === 8 ? 2 : 1));
    // PAD 2 Snare: 4, 12
    [4, 12].forEach((s) => (grid[1][s] = 2));
    // PAD 3 Closed Hat: even steps + ghost 15
    [0, 2, 4, 6, 8, 10, 12, 14, 15].forEach((s) => (grid[2][s] = s % 4 === 0 ? 2 : 1));
    // PAD 4 Open Hat: 10
    grid[3][10] = 1;
    // PAD 8 Chord Stab: 0, 11
    grid[7][0] = 2;
    grid[7][11] = 1;
  } else if (progId === 2) {
    // 808 Trap Bounce
    [0, 7, 10].forEach((s) => (grid[0][s] = 2));
    [4, 12].forEach((s) => (grid[1][s] = 2));
    // Fast trap hi-hats
    [0, 1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 14, 15].forEach(
      (s) => (grid[2][s] = s % 4 === 0 ? 2 : 1)
    );
    grid[3][6] = 1;
    grid[4][4] = 1;
    grid[4][12] = 2;
    grid[6][0] = 2;
    grid[7][8] = 1;
  } else if (progId === 3) {
    // 909 Four-on-the-Floor House
    [0, 4, 8, 12].forEach((s) => (grid[0][s] = 2));
    [4, 12].forEach((s) => (grid[4][s] = 2)); // 909 Clap
    [2, 6, 10, 14].forEach((s) => (grid[3][s] = 2)); // Off-beat Open Hat
    [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15].forEach((s) => (grid[2][s] = 1));
    [3, 11, 14].forEach((s) => (grid[7][s] = 2)); // Organ Chord
  } else {
    // 80s Synthwave Electro
    [0, 6, 8, 14].forEach((s) => (grid[0][s] = 2));
    [4, 12].forEach((s) => (grid[1][s] = 2));
    [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => (grid[2][s] = 1));
    [7, 15].forEach((s) => (grid[5][s] = 1));
    [0, 6, 12].forEach((s) => (grid[7][s] = 2));
  }
  return grid;
}

interface StepSequencer16Props {
  program: ProgramPreset;
  padBank: 'A' | 'B';
  customPadLabels: Record<string, string>;
  stepGrid: StepGridState;
  mutedPads: Record<'A' | 'B', boolean[]>;
  currentStep16: number;
  sequencerPlaying: boolean;
  onTogglePlay: () => void;
  onStepChange: (bank: 'A' | 'B', padIndex: number, stepIndex: number, nextVal: number) => void;
  onToggleMutePad: (bank: 'A' | 'B', padIndex: number) => void;
  onLoadPresetPattern: (progId: number) => void;
  onRandomizeBank: (bank: 'A' | 'B') => void;
  onClearBank: (bank: 'A' | 'B') => void;
  onAuditionPad: (padIndex: number) => void;
  onBankSwitch: (bank: 'A' | 'B') => void;
}

export const StepSequencer16: React.FC<StepSequencer16Props> = ({
  program,
  padBank,
  customPadLabels,
  stepGrid,
  mutedPads,
  currentStep16,
  sequencerPlaying,
  onTogglePlay,
  onStepChange,
  onToggleMutePad,
  onLoadPresetPattern,
  onRandomizeBank,
  onClearBank,
  onAuditionPad,
  onBankSwitch,
}) => {
  const [paintState, setPaintState] = useState<number | null>(null);

  const bankGrid = stepGrid[padBank];
  const bankMutes = mutedPads[padBank];
  const isBankA = padBank === 'A';

  // Count total active steps in current bank
  const activeStepCount = bankGrid.reduce(
    (acc, row) => acc + row.filter((v) => v > 0).length,
    0
  );

  return (
    <section
      onPointerUp={() => setPaintState(null)}
      onPointerLeave={() => setPaintState(null)}
      className="w-full bg-[#16181d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-xl flex flex-col gap-3.5 select-none"
    >
      {/* Top Sequencer Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
              isBankA
                ? 'bg-red-600/15 border-red-500/40 text-red-400'
                : 'bg-emerald-600/15 border-emerald-500/40 text-emerald-400'
            }`}
          >
            <Grid className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold text-white tracking-tight">
                MPC 16-Step Drum Grid Sequencer
              </h2>
              <span className="text-xs font-mono-tabular text-zinc-400">
                · {activeStepCount} Active Steps
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Click or drag across the 16 steps to program beats. Shift+Click any step for Accent velocity (127).
            </p>
          </div>
        </div>

        {/* Transport & Pattern Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Play / Stop Sequencer Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            data-hw-title={sequencerPlaying ? 'STOP 16-STEP SEQUENCER' : 'PLAY 16-STEP SEQUENCER'}
            data-hw-func="Starts or stops the 16-step MPC drum grid clock, triggering active pad steps in Bank A and Bank B."
            data-hw-state={sequencerPlaying ? 'PLAYING' : 'STOPPED'}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              sequencerPlaying
                ? 'bg-red-600 text-white shadow-[0_0_14px_rgba(220,38,38,0.5)]'
                : 'bg-zinc-100 hover:bg-white text-zinc-900'
            }`}
          >
            {sequencerPlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Sequencer</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Sequencer</span>
              </>
            )}
          </button>

          {/* Bank A / Bank B Switcher */}
          <div className="flex items-center p-0.5 bg-[#0d0f13] border border-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => onBankSwitch('A')}
              data-hw-title="SEQUENCER BANK A (PADS 1–8)"
              data-hw-func="Switches the 16-step drum sequencer matrix and physical MPC pads to Bank A (Red LEDs, Primary Drum Kit)."
              data-hw-state={padBank === 'A' ? 'ACTIVE BANK' : 'CLICK TO SELECT'}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                padBank === 'A'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Bank A (1–8)
            </button>
            <button
              type="button"
              onClick={() => onBankSwitch('B')}
              data-hw-title="SEQUENCER BANK B (PADS 9–16)"
              data-hw-func="Switches the 16-step drum sequencer matrix and physical MPC pads to Bank B (Green LEDs, Percussion & Stabs)."
              data-hw-state={padBank === 'B' ? 'ACTIVE BANK' : 'CLICK TO SELECT'}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                padBank === 'B'
                  ? 'bg-emerald-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Bank B (9–16)
            </button>
          </div>

          {/* Load Program Groove Button */}
          <button
            type="button"
            onClick={() => onLoadPresetPattern(program.id)}
            data-hw-title={`LOAD PROG ${program.id} DRUM PATTERN`}
            data-hw-func={`Loads the signature 16-step studio drum groove tailored for PROG ${program.id} (${program.name}).`}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 hover:border-red-500/60 border border-transparent text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span>Load PROG {program.id} Pattern</span>
          </button>

          {/* Randomize Pattern */}
          <button
            type="button"
            onClick={() => onRandomizeBank(padBank)}
            data-hw-title={`RANDOMIZE BANK ${padBank} GROOVE`}
            data-hw-func="Generates a new musical 16-step beat pattern with weighted kick, snare, hi-hat, and accent probabilities."
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 hover:border-red-500/60 border border-transparent text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <Shuffle className="w-3.5 h-3.5 text-zinc-400" />
            <span>Randomize</span>
          </button>

          {/* Clear Grid */}
          <button
            type="button"
            onClick={() => onClearBank(padBank)}
            data-hw-title={`CLEAR BANK ${padBank} SEQUENCER GRID`}
            data-hw-func={`Resets all 16 step triggers across all 8 pads in Bank ${padBank} to Off.`}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-red-950/70 border border-transparent hover:border-red-500/50 text-xs font-medium text-zinc-300 hover:text-red-300 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Grid</span>
          </button>
        </div>
      </div>

      {/* 16-Step Sequencer Matrix */}
      <div className="w-full overflow-x-auto pb-1">
        <div className="min-w-[780px] flex flex-col gap-1.5">
          {/* Step Numbers Header Row (1..16) */}
          <div className="grid grid-cols-[175px_1fr] gap-3 items-center px-1">
            <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-zinc-400 font-semibold">
              PAD / VOICE ({padBank})
            </div>
            <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5">
              {Array.from({ length: 16 }, (_, stepIdx) => {
                const isCurrent = sequencerPlaying && currentStep16 === stepIdx;
                const isBeatStart = stepIdx % 4 === 0;
                return (
                  <div
                    key={stepIdx}
                    className={`h-6 rounded flex flex-col items-center justify-center font-mono-tabular text-[10px] font-bold transition-colors ${
                      isCurrent
                        ? isBankA
                          ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                          : 'bg-emerald-500 text-zinc-950 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                        : isBeatStart
                        ? 'bg-zinc-800/90 text-zinc-200'
                        : 'bg-[#101216] text-zinc-500'
                    }`}
                  >
                    <span>{stepIdx + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8 Pad Rows (PAD 1..8) */}
          {Array.from({ length: 8 }, (_, padIdx) => {
            const customKey = `${program.id}-${padBank}-${padIdx}`;
            const sampleName =
              customPadLabels[customKey] ||
              (isBankA ? program.padNamesA[padIdx] : program.padNamesB[padIdx]);
            const isMuted = bankMutes[padIdx];
            const rowSteps = bankGrid[padIdx];

            return (
              <div
                key={padIdx}
                className={`grid grid-cols-[175px_1fr] gap-3 items-center p-1 rounded-lg transition-colors ${
                  isMuted ? 'opacity-50 bg-[#0d0e12]' : 'bg-[#111318] hover:bg-[#14171d]'
                }`}
              >
                {/* Left Track Header: Pad Trigger Audition + Label + Mute Button */}
                <div className="flex items-center justify-between gap-1.5 pr-1">
                  <button
                    type="button"
                    onClick={() => onAuditionPad(padIdx)}
                    data-hw-title={`AUDITION PAD ${padIdx + 1} [${padBank}] · ${sampleName.toUpperCase()}`}
                    data-hw-func={`Triggers a live preview hit of PAD ${padIdx + 1} (${sampleName}) without altering sequencer steps.`}
                    className="flex items-center gap-2 min-w-0 text-left group cursor-pointer"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-extrabold shrink-0 ${
                        isBankA
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30 group-hover:bg-red-600 group-hover:text-white'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-600 group-hover:text-white'
                      } transition-colors`}
                    >
                      P{padIdx + 1}
                    </span>
                    <span className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                      {sampleName}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleMutePad(padBank, padIdx)}
                    data-hw-title={`${isMuted ? 'UNMUTE' : 'MUTE'} PAD ${padIdx + 1} (${sampleName.toUpperCase()})`}
                    data-hw-func={`Mutes or unmutes PAD ${padIdx + 1} during 16-step sequencer playback and MIDI export.`}
                    data-hw-state={isMuted ? 'MUTED' : 'ACTIVE'}
                    className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                      isMuted
                        ? 'bg-red-900/50 text-red-300'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {isMuted ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* 16 Step Toggle Cells */}
                <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5">
                  {rowSteps.map((stepVal, stepIdx) => {
                    const isActive = stepVal > 0;
                    const isAccent = stepVal === 2;
                    const isPlayhead = sequencerPlaying && currentStep16 === stepIdx;
                    const isQuarterBeat = stepIdx % 4 === 0;

                    let cellStyle = '';
                    if (isActive) {
                      if (isBankA) {
                        cellStyle = isAccent
                          ? 'bg-gradient-to-b from-red-400 to-red-600 border-red-300 shadow-[0_0_12px_rgba(239,68,68,0.65)]'
                          : 'bg-red-600/85 border-red-400/80 shadow-[0_0_8px_rgba(239,68,68,0.35)]';
                      } else {
                        cellStyle = isAccent
                          ? 'bg-gradient-to-b from-emerald-300 to-emerald-500 border-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.65)]'
                          : 'bg-emerald-600/85 border-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.35)]';
                      }
                    } else {
                      cellStyle = isQuarterBeat
                        ? 'bg-[#1c1f26] border-zinc-700/80 hover:border-red-400/80 hover:bg-[#251b1f]'
                        : 'bg-[#14161b] border-zinc-800/90 hover:border-red-400/80 hover:bg-[#22181b]';
                    }

                    return (
                      <button
                        key={stepIdx}
                        type="button"
                        data-hw-title={`PAD ${padIdx + 1} (${sampleName.toUpperCase()}) · STEP ${stepIdx + 1}/16`}
                        data-hw-func="Click or drag to toggle 1/16th-note drum trigger. Hold Shift + Click to toggle Accent velocity (127)."
                        data-hw-shortcut="Click / Shift+Click"
                        data-hw-state={
                          stepVal === 2 ? 'ACCENT (VEL 127)' : stepVal === 1 ? 'ON (VEL 105)' : 'OFF'
                        }
                        onPointerDown={(e) => {
                          e.preventDefault();
                          let nextVal: number;
                          if (e.shiftKey) {
                            nextVal = stepVal === 2 ? 0 : 2;
                          } else {
                            nextVal = stepVal > 0 ? 0 : 1;
                          }
                          setPaintState(nextVal);
                          onStepChange(padBank, padIdx, stepIdx, nextVal);
                        }}
                        onPointerEnter={() => {
                          if (paintState !== null) {
                            onStepChange(padBank, padIdx, stepIdx, paintState);
                          }
                        }}
                        className={`relative h-8 rounded-[4px] border transition-all duration-75 flex flex-col items-center justify-between p-1 cursor-pointer touch-none ${cellStyle} ${
                          isPlayhead ? 'ring-2 ring-white scale-[1.04] z-10' : ''
                        }`}
                      >
                        {/* Top LED indicator bar inside step button */}
                        <span
                          className={`w-full h-1 rounded-full ${
                            isActive
                              ? isAccent
                                ? 'bg-white shadow-[0_0_4px_#fff]'
                                : 'bg-white/75'
                              : isPlayhead
                              ? 'bg-zinc-400'
                              : 'bg-zinc-800'
                          }`}
                        />

                        {/* Bottom Accent marker */}
                        {isAccent && (
                          <span className="text-[7px] font-mono-tabular font-black uppercase tracking-tighter text-white leading-none">
                            ACC
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
