export interface MidiLoopEvent {
  id: string;
  beatOffset: number; // 0..8 beats
  type: 'pad' | 'note';
  index: number; // padIndex (0..7) or midiNote (0..127)
  bank?: 'A' | 'B';
  velocity: number; // 1..127
  durationBeats?: number;
}

const PPQ = 480; // Ticks per quarter note

// Standard General MIDI / MPC Pad Note Mapping for Bank A (0..7) and Bank B (8..15)
const PAD_MIDI_NOTE_MAP: number[] = [
  // Bank A (PAD 1..8)
  36, // PAD 1: C1 Acoustic/808 Bass Drum (Kick)
  38, // PAD 2: D1 Acoustic Snare
  42, // PAD 3: F#1 Closed Hi-Hat
  46, // PAD 4: A#1 Open Hi-Hat
  39, // PAD 5: D#1 Hand Clap
  37, // PAD 6: C#1 Side Stick / Rimshot
  41, // PAD 7: F1 Low Floor Tom / Sub Drop
  49, // PAD 8: C#2 Crash / Stab
  // Bank B (PAD 1..8)
  43, // PAD 1B: G1 High Floor Tom
  51, // PAD 2B: D#2 Ride Cymbal
  45, // PAD 3B: A1 Low Tom
  47, // PAD 4B: B1 Low-Mid Tom
  48, // PAD 5B: C2 Hi-Mid Tom
  50, // PAD 6B: D2 High Tom
  56, // PAD 7B: G#2 Cowbell / FX
  57, // PAD 8B: A2 Crash Cymbal 2 / Stab
];

/**
 * Encodes a non-negative integer into a Standard MIDI Variable-Length Quantity (VLQ) byte array.
 */
function encodeVLQ(value: number): number[] {
  let v = Math.max(0, Math.round(value));
  const bytes: number[] = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

function writeUint32BE(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function writeUint16BE(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

interface RawMidiEvent {
  tick: number;
  isNoteOff: boolean;
  bytes: number[];
}

/**
 * Builds a spec-compliant Standard MIDI File (Format 0, .mid) binary Uint8Array
 * from the recorded AKAI MPK mini loop events and triggers a browser file download.
 */
export function buildMidiFileBytes(
  events: MidiLoopEvent[],
  bpm: number,
  trackName = 'AKAI MPK mini Loop',
  totalLoopBeats = 8
): Uint8Array {
  const trackBytes: number[] = [];

  // 1. Track Name Meta Event at tick 0 (FF 03 len text)
  const nameBytes = Array.from(new TextEncoder().encode(trackName.slice(0, 64)));
  trackBytes.push(0x00, 0xff, 0x03, ...encodeVLQ(nameBytes.length), ...nameBytes);

  // 2. Time Signature Meta Event at tick 0 (4/4 -> FF 58 04 04 02 18 08)
  trackBytes.push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);

  // 3. Tempo Meta Event at tick 0 (FF 51 03 tt tt tt)
  const safeBpm = Math.max(30, Math.min(300, bpm));
  const mpqn = Math.round(60_000_000 / safeBpm);
  trackBytes.push(
    0x00,
    0xff,
    0x51,
    0x03,
    (mpqn >>> 16) & 0xff,
    (mpqn >>> 8) & 0xff,
    mpqn & 0xff
  );

  // 4. Convert recorded loop events to absolute-tick Note On & Note Off messages
  const scheduled: RawMidiEvent[] = [];

  events.forEach((ev) => {
    const startTick = Math.max(0, Math.round(ev.beatOffset * PPQ));
    const durationBeats =
      ev.durationBeats && ev.durationBeats > 0
        ? ev.durationBeats
        : ev.type === 'pad'
        ? 0.25
        : 0.5;
    const durationTicks = Math.max(24, Math.round(durationBeats * PPQ));
    const endTick = startTick + durationTicks;

    const velocity = Math.max(1, Math.min(127, Math.round(ev.velocity || 100)));

    let channel = 0; // Channel 1 (0-indexed) for synth keyboard notes
    let midiNote = Math.max(0, Math.min(127, Math.round(ev.index)));

    if (ev.type === 'pad') {
      channel = 9; // Channel 10 (0-indexed 9) standard GM Drum / MPC Pad channel
      const slot = (ev.bank === 'B' ? 8 : 0) + Math.max(0, Math.min(7, ev.index));
      midiNote = PAD_MIDI_NOTE_MAP[slot] ?? 36;
    }

    // Note On: 0x90 | channel
    scheduled.push({
      tick: startTick,
      isNoteOff: false,
      bytes: [0x90 | channel, midiNote, velocity],
    });

    // Note Off: 0x80 | channel
    scheduled.push({
      tick: endTick,
      isNoteOff: true,
      bytes: [0x80 | channel, midiNote, 0x00],
    });
  });

  // Sort by tick ascending; if ticks are equal, emit Note Off before Note On
  scheduled.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.isNoteOff !== b.isNoteOff) return a.isNoteOff ? -1 : 1;
    return 0;
  });

  // 5. Encode delta times and append each MIDI event
  let lastTick = 0;
  for (const item of scheduled) {
    const delta = Math.max(0, item.tick - lastTick);
    trackBytes.push(...encodeVLQ(delta), ...item.bytes);
    lastTick = item.tick;
  }

  // 6. Pad out to the loop boundary (e.g. 8 beats = 2 bars) before End of Track
  const loopEndTick = Math.max(lastTick, Math.round(totalLoopBeats * PPQ));
  const finalDelta = Math.max(0, loopEndTick - lastTick);
  trackBytes.push(...encodeVLQ(finalDelta), 0xff, 0x2f, 0x00);

  // 7. Assemble Header Chunk (MThd) + Track Chunk (MTrk)
  const headerChunk = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    ...writeUint32BE(6),    // Header length = 6
    ...writeUint16BE(0),    // Format 0 (single multi-channel track)
    ...writeUint16BE(1),    // 1 track
    ...writeUint16BE(PPQ),  // 480 ticks per quarter note
  ];

  const trackChunkHeader = [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    ...writeUint32BE(trackBytes.length),
  ];

  return new Uint8Array([...headerChunk, ...trackChunkHeader, ...trackBytes]);
}

export function exportLoopToMidiFile(
  events: MidiLoopEvent[],
  bpm: number,
  programName: string
): void {
  const midiBytes = buildMidiFileBytes(
    events,
    bpm,
    `AKAI MPK mini - ${programName}`
  );
  const blob = new Blob([midiBytes], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);

  const safeSlug = programName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const filename = `akai-mpk-mini-${safeSlug || 'loop'}-${bpm}bpm.mid`;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
