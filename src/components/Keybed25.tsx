import React from 'react';
import { ArpMode, SwingAmount, TimeDivision } from '../audio/soundEngine';

export interface KeyDefinition {
  offset: number; // 0..24 from base C
  noteName: string;
  isBlack: boolean;
  whiteIndex: number; // 0..14 for positioning
  keyBinding: string;
  arpLabelTop: string;
  arpLabelBottom?: string;
  arpColor: 'red' | 'white';
  arpAction:
    | { type: 'div'; value: TimeDivision }
    | { type: 'mode'; value: ArpMode }
    | { type: 'latch' }
    | { type: 'oct'; value: 1 | 2 | 3 | 4 }
    | { type: 'swing'; value: SwingAmount };
}

export const KEYBED_25: KeyDefinition[] = [
  // Octave 1 (Offsets 0..11)
  { offset: 0, noteName: 'C', isBlack: false, whiteIndex: 0, keyBinding: 'Z', arpLabelTop: '1/4', arpColor: 'red', arpAction: { type: 'div', value: '1/4' } },
  { offset: 1, noteName: 'C#', isBlack: true, whiteIndex: 0, keyBinding: 'S', arpLabelTop: '1/4T', arpColor: 'red', arpAction: { type: 'div', value: '1/4T' } },
  { offset: 2, noteName: 'D', isBlack: false, whiteIndex: 1, keyBinding: 'X', arpLabelTop: '1/8', arpColor: 'red', arpAction: { type: 'div', value: '1/8' } },
  { offset: 3, noteName: 'D#', isBlack: true, whiteIndex: 1, keyBinding: 'D', arpLabelTop: '1/8T', arpColor: 'red', arpAction: { type: 'div', value: '1/8T' } },
  { offset: 4, noteName: 'E', isBlack: false, whiteIndex: 2, keyBinding: 'C', arpLabelTop: '1/16', arpColor: 'red', arpAction: { type: 'div', value: '1/16' } },
  { offset: 5, noteName: 'F', isBlack: false, whiteIndex: 3, keyBinding: 'V', arpLabelTop: '1/16T', arpColor: 'red', arpAction: { type: 'div', value: '1/16T' } },
  { offset: 6, noteName: 'F#', isBlack: true, whiteIndex: 3, keyBinding: 'G', arpLabelTop: '1/32', arpColor: 'red', arpAction: { type: 'div', value: '1/32' } },
  { offset: 7, noteName: 'G', isBlack: false, whiteIndex: 4, keyBinding: 'B', arpLabelTop: '1/32T', arpColor: 'red', arpAction: { type: 'div', value: '1/32T' } },
  { offset: 8, noteName: 'G#', isBlack: true, whiteIndex: 4, keyBinding: 'H', arpLabelTop: 'UP', arpColor: 'white', arpAction: { type: 'mode', value: 'UP' } },
  { offset: 9, noteName: 'A', isBlack: false, whiteIndex: 5, keyBinding: 'N', arpLabelTop: 'DOWN', arpColor: 'white', arpAction: { type: 'mode', value: 'DOWN' } },
  { offset: 10, noteName: 'A#', isBlack: true, whiteIndex: 5, keyBinding: 'J', arpLabelTop: 'EXCL', arpColor: 'white', arpAction: { type: 'mode', value: 'EXCL' } },
  { offset: 11, noteName: 'B', isBlack: false, whiteIndex: 6, keyBinding: 'M', arpLabelTop: 'INCL', arpColor: 'white', arpAction: { type: 'mode', value: 'INCL' } },

  // Octave 2 (Offsets 12..24)
  { offset: 12, noteName: 'C', isBlack: false, whiteIndex: 7, keyBinding: 'Q', arpLabelTop: 'ORDER', arpColor: 'white', arpAction: { type: 'mode', value: 'ORDER' } },
  { offset: 13, noteName: 'C#', isBlack: true, whiteIndex: 7, keyBinding: 'A', arpLabelTop: 'RAND', arpColor: 'white', arpAction: { type: 'mode', value: 'RAND' } },
  { offset: 14, noteName: 'D', isBlack: false, whiteIndex: 8, keyBinding: 'W', arpLabelTop: 'LATCH', arpColor: 'white', arpAction: { type: 'latch' } },
  { offset: 15, noteName: 'D#', isBlack: true, whiteIndex: 8, keyBinding: 'F', arpLabelTop: 'ARP', arpLabelBottom: 'OCT 1', arpColor: 'red', arpAction: { type: 'oct', value: 1 } },
  { offset: 16, noteName: 'E', isBlack: false, whiteIndex: 9, keyBinding: 'E', arpLabelTop: 'ARP', arpLabelBottom: 'OCT 2', arpColor: 'red', arpAction: { type: 'oct', value: 2 } },
  { offset: 17, noteName: 'F', isBlack: false, whiteIndex: 10, keyBinding: 'R', arpLabelTop: 'ARP', arpLabelBottom: 'OCT 3', arpColor: 'red', arpAction: { type: 'oct', value: 3 } },
  { offset: 18, noteName: 'F#', isBlack: true, whiteIndex: 10, keyBinding: 'K', arpLabelTop: 'ARP', arpLabelBottom: 'OCT 4', arpColor: 'red', arpAction: { type: 'oct', value: 4 } },
  { offset: 19, noteName: 'G', isBlack: false, whiteIndex: 11, keyBinding: 'T', arpLabelTop: 'SWING', arpLabelBottom: '50%', arpColor: 'white', arpAction: { type: 'swing', value: 50 } },
  { offset: 20, noteName: 'G#', isBlack: true, whiteIndex: 11, keyBinding: 'L', arpLabelTop: 'SWING', arpLabelBottom: '55%', arpColor: 'white', arpAction: { type: 'swing', value: 55 } },
  { offset: 21, noteName: 'A', isBlack: false, whiteIndex: 12, keyBinding: 'Y', arpLabelTop: 'SWING', arpLabelBottom: '57%', arpColor: 'white', arpAction: { type: 'swing', value: 57 } },
  { offset: 22, noteName: 'A#', isBlack: true, whiteIndex: 12, keyBinding: 'O', arpLabelTop: 'SWING', arpLabelBottom: '59%', arpColor: 'white', arpAction: { type: 'swing', value: 59 } },
  { offset: 23, noteName: 'B', isBlack: false, whiteIndex: 13, keyBinding: 'U', arpLabelTop: 'SWING', arpLabelBottom: '61%', arpColor: 'white', arpAction: { type: 'swing', value: 61 } },
  { offset: 24, noteName: 'C', isBlack: false, whiteIndex: 14, keyBinding: 'I', arpLabelTop: 'SWING', arpLabelBottom: '64%', arpColor: 'white', arpAction: { type: 'swing', value: 64 } },
];

interface Keybed25Props {
  baseMidiNote: number; // Default 48 (C3)
  activeNotes: Set<number>;
  showKeyShortcuts: boolean;
  timeDivision: TimeDivision;
  arpMode: ArpMode;
  arpLatch: boolean;
  arpOctaves: 1 | 2 | 3 | 4;
  swing: SwingAmount;
  onNoteDown: (midiNote: number, keyDef: KeyDefinition) => void;
  onNoteUp: (midiNote: number) => void;
  onArpFunctionSelect: (action: KeyDefinition['arpAction']) => void;
}

export const Keybed25: React.FC<Keybed25Props> = ({
  baseMidiNote,
  activeNotes,
  showKeyShortcuts,
  timeDivision,
  arpMode,
  arpLatch,
  arpOctaves,
  swing,
  onNoteDown,
  onNoteUp,
  onArpFunctionSelect,
}) => {
  const whiteKeys = KEYBED_25.filter((k) => !k.isBlack);
  const blackKeys = KEYBED_25.filter((k) => k.isBlack);

  const isActionSelected = (action: KeyDefinition['arpAction']) => {
    switch (action.type) {
      case 'div':
        return timeDivision === action.value;
      case 'mode':
        return arpMode === action.value;
      case 'latch':
        return arpLatch;
      case 'oct':
        return arpOctaves === action.value;
      case 'swing':
        return swing === action.value;
    }
  };

  // Horizontal center percent (0..100%) for each of the 25 keys so the silkscreen labels align accurately
  const getKeyHorizontalPercent = (keyDef: KeyDefinition): number => {
    const whiteWidth = 100 / 15;
    if (!keyDef.isBlack) {
      return (keyDef.whiteIndex + 0.5) * whiteWidth;
    }
    // Fine-tuned black key centers between adjacent white keys
    return (keyDef.whiteIndex + 1) * whiteWidth;
  };

  const describeArpAction = (k: KeyDefinition): { title: string; func: string } => {
    const label = `${k.arpLabelTop}${k.arpLabelBottom ? ` ${k.arpLabelBottom}` : ''}`;
    switch (k.arpAction.type) {
      case 'div':
        return {
          title: `TIME DIVISION · ${label}`,
          func: `Sets the Arpeggiator and Note Repeat rhythmic rate to ${k.arpAction.value} notes${k.arpAction.value.endsWith('T') ? ' (Triplet feel)' : ''}.`,
        };
      case 'mode':
        return {
          title: `ARP DIRECTION · ${label}`,
          func:
            k.arpAction.value === 'UP'
              ? 'Plays held arpeggiator notes in ascending pitch order (lowest to highest).'
              : k.arpAction.value === 'DOWN'
              ? 'Plays held arpeggiator notes in descending pitch order (highest to lowest).'
              : k.arpAction.value === 'EXCL'
              ? 'Exclusive Up/Down bounce: reverses direction without repeating the top or bottom boundary notes.'
              : k.arpAction.value === 'INCL'
              ? 'Inclusive Up/Down bounce: repeats the highest and lowest boundary notes when reversing.'
              : k.arpAction.value === 'ORDER'
              ? 'Plays arpeggiated notes in the exact chronological order you pressed the keys.'
              : 'Randomly selects notes from your held chord on every arpeggiator clock step.',
        };
      case 'latch':
        return {
          title: 'ARPEGGIATOR LATCH',
          func: 'Keeps the arpeggiator pattern sustaining hands-free even after you release the keys.',
        };
      case 'oct':
        return {
          title: `ARP RANGE · ${k.arpAction.value} OCTAVE${k.arpAction.value > 1 ? 'S' : ''}`,
          func: `Spans arpeggiated notes across ${k.arpAction.value} octave${k.arpAction.value > 1 ? 's' : ''} before cycling.`,
        };
      case 'swing':
        return {
          title: `MPC SWING · ${k.arpAction.value}%`,
          func:
            k.arpAction.value === 50
              ? 'Sets straight 50% timing with zero shuffle on 16th-note offbeats.'
              : `Applies classic AKAI MPC ${k.arpAction.value}% shuffle delay to every even 16th-note step.`,
        };
    }
  };

  return (
    <div className="w-full flex flex-col select-none">
      {/* Silkscreened Arpeggiator / Time Division / Swing Strip directly above keys */}
      <div className="relative w-full h-7 bg-[#15161a] border-t border-zinc-800/80 px-1">
        {KEYBED_25.map((k) => {
          const leftPct = getKeyHorizontalPercent(k);
          const selected = isActionSelected(k.arpAction);
          const arpMeta = describeArpAction(k);
          return (
            <button
              key={k.offset}
              type="button"
              onClick={() => onArpFunctionSelect(k.arpAction)}
              style={{ left: `${leftPct}%` }}
              data-hw-title={arpMeta.title}
              data-hw-func={arpMeta.func}
              data-hw-shortcut={`Key [${k.keyBinding}] in Config`}
              data-hw-state={selected ? 'ACTIVE' : 'CLICK TO SELECT'}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center px-1 py-0.5 rounded transition-all cursor-pointer ${
                selected
                  ? 'bg-red-500/25 ring-1 ring-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                  : 'hover:bg-red-500/20 hover:ring-1 hover:ring-red-400/80 hover:scale-110'
              }`}
            >
              <span
                className={`text-[7.5px] font-extrabold tracking-tight leading-none whitespace-nowrap ${
                  k.arpColor === 'red' ? 'text-[#f85149]' : 'text-zinc-200'
                }`}
              >
                {k.arpLabelTop}
              </span>
              {k.arpLabelBottom && (
                <span
                  className={`text-[7px] font-extrabold tracking-tight leading-none whitespace-nowrap mt-0.5 ${
                    k.arpColor === 'red' ? 'text-[#f85149]' : 'text-zinc-200'
                  }`}
                >
                  {k.arpLabelBottom}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Recessed Keybed Cavity */}
      <div className="relative w-full h-56 sm:h-64 bg-[#090a0c] p-1.5 pt-2 rounded-b-lg shadow-[inset_0_6px_12px_rgba(0,0,0,0.95)] border-t-4 border-[#0e0f12]">
        {/* Red Felt Strip at Top of Keys */}
        <div className="absolute top-1 left-2 right-2 h-1.5 bg-gradient-to-r from-red-900 via-red-700 to-red-900 opacity-85 z-10 pointer-events-none" />

        {/* 15 White Keys */}
        <div className="relative w-full h-full grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[2px]">
          {whiteKeys.map((k) => {
            const midiNote = baseMidiNote + k.offset;
            const isPressed = activeNotes.has(midiNote);
            const octaveNumber = Math.floor(midiNote / 12) - 1;
            const fullNoteName = `${k.noteName}${octaveNumber}`;
            const arpLabel = `${k.arpLabelTop}${k.arpLabelBottom ? ` ${k.arpLabelBottom}` : ''}`;

            return (
              <button
                key={k.offset}
                type="button"
                data-hw-title={`SYNTH KEY ${fullNoteName} (MIDI ${midiNote})`}
                data-hw-func={`Plays polyphonic synthesizer note ${fullNoteName}. Secondary Arp Function: ${arpLabel}.`}
                data-hw-shortcut={`Key [${k.keyBinding}]`}
                data-hw-state={`ARP FN: ${arpLabel}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  onNoteDown(midiNote, k);
                }}
                onPointerEnter={(e) => {
                  if (e.buttons === 1) {
                    onNoteDown(midiNote, k);
                  }
                }}
                onPointerLeave={() => {
                  onNoteUp(midiNote);
                }}
                onPointerUp={() => {
                  onNoteUp(midiNote);
                }}
                className={`relative h-full w-full rounded-b-[5px] transition-all duration-75 flex flex-col justify-end items-center pb-2.5 cursor-pointer touch-none group ${
                  isPressed ? 'mpk-white-key-active' : 'mpk-white-key'
                }`}
              >
                {isPressed && (
                  <span className="w-2 h-2 rounded-full bg-red-500 mb-2 shadow-[0_0_8px_#ef4444]" />
                )}
                {showKeyShortcuts && (
                  <span className="text-[10px] font-mono-tabular font-bold text-zinc-500 group-hover:text-white group-hover:bg-red-600 bg-zinc-200/80 px-1.5 py-0.5 rounded mb-1 transition-colors">
                    {k.keyBinding}
                  </span>
                )}
                <span className="text-[9px] font-bold text-zinc-400 group-hover:text-red-600 tracking-tight transition-colors">
                  {k.noteName === 'C' ? `C${octaveNumber}` : k.noteName}
                </span>
              </button>
            );
          })}
        </div>

        {/* 10 Black Keys Overlaid */}
        <div className="absolute inset-x-1.5 top-2 h-[61%] pointer-events-none">
          {blackKeys.map((k) => {
            const midiNote = baseMidiNote + k.offset;
            const isPressed = activeNotes.has(midiNote);
            const octaveNumber = Math.floor(midiNote / 12) - 1;
            const fullNoteName = `${k.noteName}${octaveNumber}`;
            const arpLabel = `${k.arpLabelTop}${k.arpLabelBottom ? ` ${k.arpLabelBottom}` : ''}`;
            const whiteWidth = 100 / 15;
            const leftPct = (k.whiteIndex + 1) * whiteWidth;

            return (
              <button
                key={k.offset}
                type="button"
                data-hw-title={`SYNTH KEY ${fullNoteName} (MIDI ${midiNote})`}
                data-hw-func={`Plays polyphonic synthesizer note ${fullNoteName}. Secondary Arp Function: ${arpLabel}.`}
                data-hw-shortcut={`Key [${k.keyBinding}]`}
                data-hw-state={`ARP FN: ${arpLabel}`}
                style={{
                  left: `${leftPct}%`,
                  width: `${whiteWidth * 0.64}%`,
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  onNoteDown(midiNote, k);
                }}
                onPointerEnter={(e) => {
                  if (e.buttons === 1) {
                    onNoteDown(midiNote, k);
                  }
                }}
                onPointerLeave={() => {
                  onNoteUp(midiNote);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onNoteUp(midiNote);
                }}
                className={`pointer-events-auto absolute top-0 -translate-x-1/2 h-full rounded-b-[4px] transition-all duration-75 flex flex-col justify-end items-center pb-2 cursor-pointer z-20 touch-none group ${
                  isPressed ? 'mpk-black-key-active' : 'mpk-black-key'
                }`}
              >
                {showKeyShortcuts && (
                  <span className="text-[9px] font-mono-tabular font-bold text-zinc-300 group-hover:text-white group-hover:bg-red-600 bg-zinc-800/90 px-1 py-0.2 rounded mb-0.5 transition-colors">
                    {k.keyBinding}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

