import {
  KeyboardVoiceMode,
  KnobParameters,
  ProgramPreset,
  SwingAmount,
} from './soundEngine';
import { BeatRecordedEvent } from '../components/BeatStudioRecorder';
import { StepGridState } from '../components/StepSequencer16';

interface WavExportOptions {
  recordedEvents: BeatRecordedEvent[];
  stepGrid: StepGridState;
  mutedTracks: { drums: boolean; bass: boolean; synth: boolean };
  mutedPads: Record<'A' | 'B', boolean[]>;
  bpm: number;
  swing: SwingAmount;
  program: ProgramPreset;
  knobs: KnobParameters;
  loopCycles?: number; // Default 2 cycles of the 2-bar loop = 4 bars total
}

function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const numSamples = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function scheduleOfflinePad(
  ctx: BaseAudioContext,
  dest: AudioNode,
  noiseBuffer: AudioBuffer,
  program: ProgramPreset,
  knobs: KnobParameters,
  padIndex: number,
  bank: 'A' | 'B',
  velocity: number,
  time: number
) {
  const vel = Math.max(0.15, Math.min(1, velocity / 127));
  const slot = bank === 'A' ? padIndex : padIndex + 8;
  const progId = program.id;
  const pitchShift = progId === 2 ? 0.9 : progId === 3 ? 1.08 : progId === 4 ? 1.15 : 1.0;

  const playKick = (endFreq: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.075);
    osc.frequency.exponentialRampToValueAtTime(Math.max(28, endFreq * 0.75), time + duration);
    gain.gain.setValueAtTime(vel * 0.95, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(850, time);
    clickOsc.frequency.exponentialRampToValueAtTime(90, time + 0.02);
    clickGain.gain.setValueAtTime(vel * 0.4, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.022);

    osc.connect(gain);
    clickOsc.connect(clickGain);
    gain.connect(dest);
    clickGain.connect(dest);
    osc.start(time);
    clickOsc.start(time);
    osc.stop(time + duration + 0.02);
    clickOsc.stop(time + 0.03);
  };

  const playSnare = (bodyFreq: number, noiseDecay: number) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(bodyFreq * 1.4, time);
    osc.frequency.exponentialRampToValueAtTime(bodyFreq, time + 0.08);
    oscGain.gain.setValueAtTime(vel * 0.55, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vel * 0.65, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + noiseDecay);

    osc.connect(oscGain);
    oscGain.connect(dest);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    osc.start(time);
    noise.start(time);
    osc.stop(time + 0.16);
    noise.stop(time + noiseDecay + 0.02);
  };

  const playHiHat = (decay: number, cutoff: number) => {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(cutoff, time);
    bandpass.Q.setValueAtTime(1.8, time);
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(5500, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vel * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(dest);
    noise.start(time);
    noise.stop(time + decay + 0.02);
  };

  const playClap = () => {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, time);
    filter.Q.setValueAtTime(1.4, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    for (let i = 0; i < 3; i++) {
      const t = time + i * 0.011;
      gain.gain.setValueAtTime(vel * 0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.009);
    }
    gain.gain.setValueAtTime(vel * 0.7, time + 0.033);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
    noise.stop(time + 0.26);
  };

  const playRimshot = (freq: number) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 2.35, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.8, time);
    filter.Q.setValueAtTime(3.5, time);
    gain.gain.setValueAtTime(vel * 0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.065);
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.07);
    osc2.stop(time + 0.07);
  };

  const playSubBassHit = (freq: number) => {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.06);
    sub.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, time);
    filter.frequency.exponentialRampToValueAtTime(95, time + 0.5);
    gain.gain.setValueAtTime(vel * 0.75, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.65);
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    sub.start(time);
    osc.stop(time + 0.68);
    sub.stop(time + 0.68);
  };

  const playChordStab = (freqs: number[]) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const normalized = Math.max(0, Math.min(1, knobs.k1Cutoff / 127));
    const cutoff = 90 * Math.pow(155, normalized);
    filter.frequency.setValueAtTime(Math.min(12000, cutoff * 1.4), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(240, cutoff * 0.45), time + 0.42);
    filter.Q.setValueAtTime(3.2, time);
    const masterChordGain = ctx.createGain();
    masterChordGain.gain.setValueAtTime(vel * 0.16, time);
    masterChordGain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);
    filter.connect(masterChordGain);
    masterChordGain.connect(dest);
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = progId === 2 ? 'sine' : idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, time);
      osc.detune.setValueAtTime((idx - 2) * 6, time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + 0.58);
    });
  };

  const playTom = (freq: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.55, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.19);
    gain.gain.setValueAtTime(vel * 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.3);
  };

  const playCrash = () => {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vel * 0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.15);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
    noise.stop(time + 1.2);
  };

  switch (slot) {
    case 0:
      playKick(progId === 2 ? 42 : 52 * pitchShift, progId === 2 ? 0.55 : 0.32);
      break;
    case 1:
      playSnare(185 * pitchShift, progId === 4 ? 0.36 : 0.22);
      break;
    case 2:
      playHiHat(0.055, 7500 * pitchShift);
      break;
    case 3:
      playHiHat(0.34, 6800 * pitchShift);
      break;
    case 4:
      playClap();
      break;
    case 5:
      playRimshot(420 * pitchShift);
      break;
    case 6:
      playSubBassHit(progId === 2 ? 36.7 : 55.0);
      break;
    case 7:
      playChordStab([261.63, 311.13, 392.0, 466.16, 587.33]);
      break;
    case 8:
      playTom(98 * pitchShift);
      break;
    case 9:
      playCrash();
      break;
    case 10:
      playTom(130 * pitchShift);
      break;
    case 11:
      playTom(175 * pitchShift);
      break;
    case 12:
      playChordStab([196.0, 293.66, 392.0, 493.88]);
      break;
    case 13:
      playChordStab([293.66, 349.23, 440.0, 523.25, 659.25]);
      break;
    case 14:
      playSubBassHit(55.0);
      break;
    case 15:
      playChordStab([349.23, 415.3, 523.25, 622.25, 783.99]);
      break;
  }
}

function scheduleOfflineNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  program: ProgramPreset,
  knobs: KnobParameters,
  midiNote: number,
  velocity: number,
  voiceMode: KeyboardVoiceMode,
  startTime: number,
  durationSec: number
) {
  const isBassGuitar = voiceMode !== 'synth';
  const rawFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
  const freq = isBassGuitar ? rawFreq * 0.5 : rawFreq;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const subOsc = ctx.createOscillator();

  let osc2Ratio = Math.pow(2, program.osc2OctaveOffset);
  if (!isBassGuitar) {
    osc1.type = program.osc1Type;
    osc2.type = program.osc2Type;
    subOsc.type = 'sine';
  } else if (voiceMode === 'finger-bass') {
    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    subOsc.type = 'sine';
    osc2Ratio = 1;
  } else if (voiceMode === 'slap-bass') {
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    subOsc.type = 'sine';
    osc2Ratio = 2;
  } else if (voiceMode === 'picked-bass') {
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    subOsc.type = 'triangle';
    osc2Ratio = 1;
  } else {
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    subOsc.type = 'sine';
    osc2Ratio = 1;
  }

  osc1.frequency.setValueAtTime(freq, startTime);
  osc2.frequency.setValueAtTime(freq * osc2Ratio, startTime);
  subOsc.frequency.setValueAtTime(freq * 0.5, startTime);

  const detuneCents = isBassGuitar
    ? (knobs.k5Detune / 127) * 16
    : (knobs.k5Detune / 127) * 45;
  osc1.detune.setValueAtTime(-detuneCents, startTime);
  osc2.detune.setValueAtTime(detuneCents, startTime);

  const osc1Gain = ctx.createGain();
  const osc2Gain = ctx.createGain();
  const subGain = ctx.createGain();
  osc1Gain.gain.value = isBassGuitar ? 0.48 : 0.35;
  osc2Gain.gain.value = 0.28;
  subGain.gain.value = (isBassGuitar ? 0.38 : 0) + (knobs.k6SubMix / 127) * 0.4;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const normalizedCut = Math.max(0, Math.min(1, knobs.k1Cutoff / 127));
  const targetCutoff = 90 * Math.pow(155, normalizedCut);
  const peakCut = isBassGuitar ? Math.min(3600, Math.max(480, targetCutoff * 0.8)) : Math.min(15000, targetCutoff * 1.4);
  const sustainCut = isBassGuitar ? Math.max(160, peakCut * 0.3) : Math.max(90, targetCutoff);
  filter.frequency.setValueAtTime(peakCut, startTime);
  filter.frequency.exponentialRampToValueAtTime(sustainCut, startTime + 0.14);
  filter.Q.setValueAtTime(1.5 + (knobs.k2Resonance / 127) * 8, startTime);

  const vca = ctx.createGain();
  const velGain = (velocity / 127) * (isBassGuitar ? 0.56 : 0.42);
  const attackSec = isBassGuitar
    ? 0.004 + (knobs.k3Attack / 127) * 0.06
    : 0.005 + Math.pow(knobs.k3Attack / 127, 2) * 0.5;
  const releaseSec = 0.04 + Math.pow(knobs.k4Release / 127, 2) * 1.2;
  const noteEnd = startTime + Math.max(0.08, durationSec);

  vca.gain.setValueAtTime(0.0001, startTime);
  vca.gain.linearRampToValueAtTime(velGain, startTime + attackSec);
  vca.gain.exponentialRampToValueAtTime(velGain * 0.65, Math.min(noteEnd, startTime + attackSec + 0.18));
  vca.gain.setValueAtTime(velGain * 0.65, noteEnd);
  vca.gain.exponentialRampToValueAtTime(0.0001, noteEnd + releaseSec);

  osc1.connect(osc1Gain);
  osc2.connect(osc2Gain);
  subOsc.connect(subGain);
  osc1Gain.connect(filter);
  osc2Gain.connect(filter);
  subGain.connect(filter);
  filter.connect(vca);
  vca.connect(dest);

  osc1.start(startTime);
  osc2.start(startTime);
  subOsc.start(startTime);
  const stopTime = noteEnd + releaseSec + 0.04;
  osc1.stop(stopTime);
  osc2.stop(stopTime);
  subOsc.stop(stopTime);
}

export async function exportBeatToWavFile(options: WavExportOptions): Promise<boolean> {
  const {
    recordedEvents,
    stepGrid,
    mutedTracks,
    mutedPads,
    bpm,
    swing,
    program,
    knobs,
    loopCycles = 2,
  } = options;

  const sampleRate = 44100;
  const secondsPerBeat = 60 / bpm;
  const loopDurationSec = 8 * secondsPerBeat; // 2 bars = 8 beats per cycle
  const tailSec = 1.0;
  const totalDurationSec = loopDurationSec * loopCycles + tailSec;
  const totalFrames = Math.ceil(sampleRate * totalDurationSec);

  const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 0.88;

  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -10;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  masterGain.connect(compressor);
  compressor.connect(offlineCtx.destination);

  const noiseBuffer = createNoiseBuffer(offlineCtx);
  const baseSixteenthSec = secondsPerBeat * 0.25;

  const getStepTimeSec = (cycleIdx: number, step32: number): number => {
    const cycleStart = cycleIdx * loopDurationSec;
    const isOdd = step32 % 2 === 1;
    const swingOffset = isOdd ? baseSixteenthSec * ((swing - 50) / 50) * 0.5 : 0;
    return cycleStart + step32 * baseSixteenthSec + swingOffset;
  };

  let scheduledCount = 0;

  for (let cycle = 0; cycle < loopCycles; cycle++) {
    // 1. Schedule 16-Step Sequencer Grid (repeats twice per 32-step cycle)
    if (!mutedTracks.drums) {
      for (let step32 = 0; step32 < 32; step32++) {
        const step16 = step32 % 16;
        const stepTime = getStepTimeSec(cycle, step32);
        (['A', 'B'] as const).forEach((bank) => {
          const grid = stepGrid[bank];
          const mutes = mutedPads[bank];
          for (let padIdx = 0; padIdx < 8; padIdx++) {
            if (mutes[padIdx]) continue;
            const val = grid[padIdx][step16];
            if (val > 0) {
              const vel = val === 2 ? 126 : 106;
              scheduleOfflinePad(
                offlineCtx,
                masterGain,
                noiseBuffer,
                program,
                knobs,
                padIdx,
                bank,
                vel,
                stepTime
              );
              scheduledCount++;
            }
          }
        });
      }
    }

    // 2. Schedule Recorded Multi-Track Events (Drums, Bass Guitar, Synth)
    recordedEvents.forEach((ev) => {
      const step32 = ((Math.round(ev.beatOffset * 4) % 32) + 32) % 32;
      const startTime = getStepTimeSec(cycle, step32);

      if (ev.type === 'pad') {
        if (mutedTracks.drums) return;
        scheduleOfflinePad(
          offlineCtx,
          masterGain,
          noiseBuffer,
          program,
          knobs,
          ev.index,
          ev.bank || 'A',
          ev.velocity,
          startTime
        );
        scheduledCount++;
      } else {
        const voiceMode: KeyboardVoiceMode = ev.voiceMode || 'synth';
        const isBass = voiceMode !== 'synth';
        if (isBass && mutedTracks.bass) return;
        if (!isBass && mutedTracks.synth) return;

        const durSec = Math.max(0.09, (ev.durationBeats ?? 0.5) * secondsPerBeat * 0.88);
        scheduleOfflineNote(
          offlineCtx,
          masterGain,
          program,
          knobs,
          ev.index,
          ev.velocity,
          voiceMode,
          startTime,
          durSec
        );
        scheduledCount++;
      }
    });
  }

  if (scheduledCount === 0) {
    return false;
  }

  const renderedBuffer = await offlineCtx.startRendering();
  const wavBlob = encodeAudioBufferToWav(renderedBuffer);
  const url = URL.createObjectURL(wavBlob);

  const safeProg = program.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const link = document.createElement('a');
  link.href = url;
  link.download = `akai-mpk-beat-${safeProg}-${bpm}bpm.wav`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
