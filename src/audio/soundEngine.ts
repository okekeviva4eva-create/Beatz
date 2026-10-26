export type TimeDivision = '1/4' | '1/4T' | '1/8' | '1/8T' | '1/16' | '1/16T' | '1/32' | '1/32T';
export type ArpMode = 'UP' | 'DOWN' | 'EXCL' | 'INCL' | 'ORDER' | 'RAND';
export type SwingAmount = 50 | 55 | 57 | 59 | 61 | 64;

export type KeyboardVoiceMode =
  | 'synth'
  | 'finger-bass'
  | 'slap-bass'
  | 'picked-bass'
  | 'fretless-bass';

export interface KeyboardVoiceOption {
  id: KeyboardVoiceMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const KEYBOARD_VOICE_OPTIONS: KeyboardVoiceOption[] = [
  {
    id: 'synth',
    label: 'Program Synth',
    shortLabel: 'Synth',
    description: 'Uses the active hardware Program (PROG 1–4) polyphonic synthesizer voice.',
  },
  {
    id: 'finger-bass',
    label: 'Fingered P-Bass Guitar',
    shortLabel: 'Finger Bass',
    description: 'Warm vintage 4-string Precision Bass guitar played with fingers, rich in low-mid punch and sub weight.',
  },
  {
    id: 'slap-bass',
    label: 'Slap & Pop Jazz Bass',
    shortLabel: 'Slap Bass',
    description: 'Funky thumb-slap and pop electric Jazz Bass guitar with metallic fret snap and bridge pickup bite.',
  },
  {
    id: 'picked-bass',
    label: 'Picked Rock Bass Guitar',
    shortLabel: 'Picked Bass',
    description: 'Aggressive plectrum-picked electric bass guitar with crisp attack transient and upper-mid growl.',
  },
  {
    id: 'fretless-bass',
    label: 'Fretless Mwah Bass Guitar',
    shortLabel: 'Fretless Bass',
    description: 'Expressive fretless electric bass guitar with smooth micro-slide pitch articulation and vocal formant swell.',
  },
];

export interface KnobParameters {
  k1Cutoff: number;     // 0..127 -> 80Hz..14000Hz
  k2Resonance: number;  // 0..127 -> 0.7..16
  k3Attack: number;     // 0..127 -> 0.004s..0.8s
  k4Release: number;    // 0..127 -> 0.04s..2.5s
  k5Detune: number;     // 0..127 -> 0..40 cents
  k6SubMix: number;     // 0..127 -> 0..1 sub oscillator / saturation
  k7DelayMix: number;   // 0..127 -> 0..0.65
  k8ReverbMix: number;  // 0..127 -> 0..0.75
}

export interface ProgramPreset {
  id: number; // 1..4
  name: string;
  category: string;
  osc1Type: OscillatorType;
  osc2Type: OscillatorType;
  osc2OctaveOffset: number;
  defaultKnobs: KnobParameters;
  padNamesA: [string, string, string, string, string, string, string, string];
  padNamesB: [string, string, string, string, string, string, string, string];
}

export const PROGRAM_PRESETS: ProgramPreset[] = [
  {
    id: 1,
    name: 'MPC Boom-Bap & Warm Poly',
    category: 'Hip-Hop / Neo-Soul',
    osc1Type: 'sawtooth',
    osc2Type: 'triangle',
    osc2OctaveOffset: 0,
    defaultKnobs: {
      k1Cutoff: 92,
      k2Resonance: 28,
      k3Attack: 8,
      k4Release: 48,
      k5Detune: 32,
      k6SubMix: 55,
      k7DelayMix: 28,
      k8ReverbMix: 35,
    },
    padNamesA: [
      'SP-1200 Kick',
      'Crispy Snare',
      'Closed Hat',
      'Open Hat',
      'Vinyl Clap',
      'Rimshot Knock',
      'P-Bass Slide Drop',
      'Rhodes Min9 Stab',
    ],
    padNamesB: [
      'Dusty Shaker',
      'Crash Cymbal',
      'Lo-Fi Tom Low',
      'Lo-Fi Tom Hi',
      'Slap Bass Pop',
      'Electric Piano 7th',
      'Tape Stop FX',
      'Soul Vocal Chop',
    ],
  },
  {
    id: 2,
    name: '808 Trap & FM Glass Keys',
    category: 'Trap / R&B',
    osc1Type: 'sine',
    osc2Type: 'square',
    osc2OctaveOffset: 1,
    defaultKnobs: {
      k1Cutoff: 78,
      k2Resonance: 18,
      k3Attack: 5,
      k4Release: 64,
      k5Detune: 18,
      k6SubMix: 80,
      k7DelayMix: 40,
      k8ReverbMix: 52,
    },
    padNamesA: [
      '808 Spinz Kick',
      'Lex Luger Snare',
      'Tight Tick Hat',
      'Open 808 Hat',
      'Stadium Clap',
      '808 Cowbell',
      '808 Glide C1',
      '808 Glide F1',
    ],
    padNamesB: [
      'Triangle Perc',
      'Reverse Cymbal',
      'Chant Hey',
      'Orchestra Hit',
      'Dark Bell Chord',
      'Sub Riser FX',
      'Laser Zap',
      'Trap Brass Stab',
    ],
  },
  {
    id: 3,
    name: '909 Warehouse & Acid 303',
    category: 'House / Techno',
    osc1Type: 'sawtooth',
    osc2Type: 'sawtooth',
    osc2OctaveOffset: -1,
    defaultKnobs: {
      k1Cutoff: 64,
      k2Resonance: 86,
      k3Attack: 4,
      k4Release: 30,
      k5Detune: 14,
      k6SubMix: 70,
      k7DelayMix: 46,
      k8ReverbMix: 28,
    },
    padNamesA: [
      'TR-909 Kick',
      'TR-909 Snare',
      '909 Closed Hat',
      '909 Open Hat',
      '909 House Clap',
      '909 Rim Click',
      '909 Ride Bell',
      'M1 Organ Chord',
    ],
    padNamesB: [
      '909 Low Tom',
      '909 Mid Tom',
      '909 Hi Tom',
      '909 Crash',
      'Acid Squelch',
      'Rave Hoover Hit',
      'Funk Slap Bass',
      'Dub Delay Chord',
    ],
  },
  {
    id: 4,
    name: 'LinnDrum & Analog Synthwave',
    category: '80s Retro / Electro',
    osc1Type: 'square',
    osc2Type: 'sawtooth',
    osc2OctaveOffset: 0,
    defaultKnobs: {
      k1Cutoff: 104,
      k2Resonance: 36,
      k3Attack: 12,
      k4Release: 72,
      k5Detune: 48,
      k6SubMix: 60,
      k7DelayMix: 54,
      k8ReverbMix: 68,
    },
    padNamesA: [
      'Linn Punch Kick',
      'Gated Reverb Snare',
      'Analog Cabasa',
      'Open Metal Hat',
      'Simmons Clap',
      'Syndrum Dive',
      'Picked Bass Riff',
      'Juno Chorus Fifth',
    ],
    padNamesB: [
      'Gated Tom Low',
      'Gated Tom Mid',
      'Gated Tom High',
      'Shimmer Crash',
      'Arp Bell Pluck',
      'Laser Sweep',
      'Octave Bass Hit',
      'Poly Dream Chord',
    ],
  },
];

interface ActiveVoice {
  midiNote: number;
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  subOsc: OscillatorNode;
  filter: BiquadFilterNode;
  vca: GainNode;
  baseFreq: number;
  osc2Ratio: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayWet: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbWet: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private activeVoices: Map<number, ActiveVoice> = new Map();
  private customPadBuffers: Map<string, AudioBuffer> = new Map();
  private activePadSources: Map<string, AudioBufferSourceNode> = new Map();
  private mediaDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedAudioChunks: Blob[] = [];
  private recordStartTimeMs = 0;
  private pitchBendNorm = 0; // -1..1
  private modNorm = 0;       // -1..1
  private currentProgram: ProgramPreset = PROGRAM_PRESETS[0];
  private keyboardVoiceMode: KeyboardVoiceMode = 'synth';
  private knobs: KnobParameters = { ...PROGRAM_PRESETS[0].defaultKnobs };
  private masterVolume = 0.85;

  public setKeyboardVoiceMode(mode: KeyboardVoiceMode) {
    this.keyboardVoiceMode = mode;
  }

  public getKeyboardVoiceMode(): KeyboardVoiceMode {
    return this.keyboardVoiceMode;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;

      // Dynamics compressor to keep punchy drums & poly chords clean
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -10;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.82;

      // Stereo / Ping-pong style delay bus
      this.delayNode = this.ctx.createDelay(2.0);
      this.delayNode.delayTime.value = 0.28;
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.value = 0.36;
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2600;

      this.delayWet = this.ctx.createGain();
      this.delayWet.gain.value = (this.knobs.k7DelayMix / 127) * 0.55;

      this.delayNode.connect(delayFilter);
      delayFilter.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
      this.delayNode.connect(this.delayWet);
      this.delayWet.connect(compressor);

      // Algorithmic Studio Reverb impulse response
      this.reverbConvolver = this.ctx.createConvolver();
      this.reverbConvolver.buffer = this.createImpulseResponse(2.1, 2.4);
      this.reverbWet = this.ctx.createGain();
      this.reverbWet.gain.value = (this.knobs.k8ReverbMix / 127) * 0.65;
      this.reverbConvolver.connect(this.reverbWet);
      this.reverbWet.connect(compressor);

      this.masterGain.connect(compressor);
      this.masterGain.connect(this.delayNode);
      this.masterGain.connect(this.reverbConvolver);

      compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      if (typeof this.ctx.createMediaStreamDestination === 'function') {
        this.mediaDest = this.ctx.createMediaStreamDestination();
        compressor.connect(this.mediaDest);
      }

      this.noiseBuffer = this.createWhiteNoiseBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private createWhiteNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public playMetronomeClick(isDownbeat: boolean) {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const freq = isDownbeat ? 1320 : 880;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.032);

    gain.gain.setValueAtTime(isDownbeat ? 0.28 : 0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.036);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public startMasterAudioRecording(): boolean {
    this.ensureContext();
    if (!this.mediaDest || typeof MediaRecorder === 'undefined') {
      return false;
    }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      return true;
    }

    this.recordedAudioChunks = [];
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    let selectedMime = '';
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    this.mediaRecorder = selectedMime
      ? new MediaRecorder(this.mediaDest.stream, { mimeType: selectedMime })
      : new MediaRecorder(this.mediaDest.stream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedAudioChunks.push(e.data);
      }
    };

    this.recordStartTimeMs = performance.now();
    this.mediaRecorder.start(100);
    return true;
  }

  public stopMasterAudioRecording(): Promise<{
    url: string;
    blob: Blob;
    mimeType: string;
    durationSec: number;
  } | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      const durationSec = Math.max(0.5, (performance.now() - this.recordStartTimeMs) / 1000);
      const mimeType = this.mediaRecorder.mimeType || 'audio/webm';

      this.mediaRecorder.onstop = () => {
        if (this.recordedAudioChunks.length === 0) {
          resolve(null);
          return;
        }
        const blob = new Blob(this.recordedAudioChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        resolve({ url, blob, mimeType, durationSec });
      };

      this.mediaRecorder.stop();
    });
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.015);
    }
  }

  public setProgram(program: ProgramPreset) {
    this.currentProgram = program;
  }

  public updateKnobs(newKnobs: KnobParameters) {
    this.knobs = { ...newKnobs };
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const cutoffHz = this.getCutoffHz();
    const qVal = this.getResonanceQ();
    const detuneCents = (this.knobs.k5Detune / 127) * 45;

    if (this.delayWet) {
      this.delayWet.gain.setTargetAtTime((this.knobs.k7DelayMix / 127) * 0.55, now, 0.02);
    }
    if (this.reverbWet) {
      this.reverbWet.gain.setTargetAtTime((this.knobs.k8ReverbMix / 127) * 0.65, now, 0.02);
    }

    this.activeVoices.forEach((voice) => {
      voice.filter.frequency.setTargetAtTime(cutoffHz, now, 0.02);
      voice.filter.Q.setTargetAtTime(qVal, now, 0.02);
      voice.osc1.detune.setTargetAtTime(-detuneCents, now, 0.02);
      voice.osc2.detune.setTargetAtTime(detuneCents, now, 0.02);
    });
  }

  public setThumbstick(pitchX: number, modY: number) {
    this.pitchBendNorm = Math.max(-1, Math.min(1, pitchX));
    this.modNorm = Math.max(-1, Math.min(1, modY));
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Pitch bend range: +/- 2 semitones
    const bendMultiplier = Math.pow(2, (this.pitchBendNorm * 2) / 12);
    const cutoffHz = this.getCutoffHz();

    this.activeVoices.forEach((voice) => {
      const bentFreq = voice.baseFreq * bendMultiplier;
      voice.osc1.frequency.setTargetAtTime(bentFreq, now, 0.015);
      voice.osc2.frequency.setTargetAtTime(bentFreq * voice.osc2Ratio, now, 0.015);
      voice.subOsc.frequency.setTargetAtTime(bentFreq * 0.5, now, 0.015);
      voice.filter.frequency.setTargetAtTime(cutoffHz, now, 0.02);
    });
  }

  private getCutoffHz(): number {
    // Exponential mapping from 0..127 -> 90Hz..14000Hz, plus Y-axis thumbstick mod
    const normalized = Math.max(0, Math.min(1, this.knobs.k1Cutoff / 127 + this.modNorm * 0.35));
    return 90 * Math.pow(155, normalized);
  }

  private getResonanceQ(): number {
    return 0.7 + (this.knobs.k2Resonance / 127) * 15 + Math.abs(this.modNorm) * 4;
  }

  public noteOn(midiNote: number, velocity = 100, voiceModeOverride?: KeyboardVoiceMode) {
    const ctx = this.ensureContext();
    if (this.activeVoices.has(midiNote)) {
      this.noteOff(midiNote);
    }

    const now = ctx.currentTime;
    const voiceMode = voiceModeOverride || this.keyboardVoiceMode;
    const isBassGuitar = voiceMode !== 'synth';
    // Bass guitar plays 1 octave deeper so C3..C5 on the 25-key bed maps to C2..C4 / E1..E3 bass range
    const rawFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const baseFreq = isBassGuitar ? rawFreq * 0.5 : rawFreq;
    const bendMultiplier = Math.pow(2, (this.pitchBendNorm * 2) / 12);
    const freq = baseFreq * bendMultiplier;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const subOsc = ctx.createOscillator();

    let osc2Ratio = Math.pow(2, this.currentProgram.osc2OctaveOffset);

    if (!isBassGuitar) {
      osc1.type = this.currentProgram.osc1Type;
      osc2.type = this.currentProgram.osc2Type;
      subOsc.type = 'sine';
    } else if (voiceMode === 'finger-bass') {
      // Vintage Precision Bass: warm triangle fundamental + sawtooth string harmonics
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      subOsc.type = 'sine';
      osc2Ratio = 1;
    } else if (voiceMode === 'slap-bass') {
      // Funk Jazz Bass: bright sawtooth + square bridge pickup harmonic bite
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      subOsc.type = 'sine';
      osc2Ratio = 2; // Upper octave harmonic pop
    } else if (voiceMode === 'picked-bass') {
      // Picked Rock Bass: dual sawtooth + square plectrum grit
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      subOsc.type = 'triangle';
      osc2Ratio = 1;
    } else {
      // Fretless Mwah Bass: expressive sawtooth + triangle chorus glide
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      subOsc.type = 'sine';
      osc2Ratio = 1;
    }

    if (voiceMode === 'fretless-bass') {
      // Subtle fretless finger slide-in articulation
      osc1.frequency.setValueAtTime(freq * 0.965, now);
      osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.055);
      osc2.frequency.setValueAtTime(freq * osc2Ratio * 0.965, now);
      osc2.frequency.exponentialRampToValueAtTime(freq * osc2Ratio, now + 0.055);
      subOsc.frequency.setValueAtTime(freq * 0.5, now);
    } else {
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * osc2Ratio, now);
      subOsc.frequency.setValueAtTime(freq * 0.5, now);
    }

    const detuneCents =
      voiceMode === 'fretless-bass'
        ? Math.max(14, (this.knobs.k5Detune / 127) * 35)
        : isBassGuitar
        ? (this.knobs.k5Detune / 127) * 16
        : (this.knobs.k5Detune / 127) * 45;

    osc1.detune.setValueAtTime(-detuneCents, now);
    osc2.detune.setValueAtTime(detuneCents, now);

    const osc1Gain = ctx.createGain();
    const osc2Gain = ctx.createGain();
    const subGain = ctx.createGain();

    if (!isBassGuitar) {
      osc1Gain.gain.value = 0.35;
      osc2Gain.gain.value = 0.28;
      subGain.gain.value = (this.knobs.k6SubMix / 127) * 0.45;
    } else if (voiceMode === 'finger-bass') {
      osc1Gain.gain.value = 0.52;
      osc2Gain.gain.value = 0.26;
      subGain.gain.value = 0.38 + (this.knobs.k6SubMix / 127) * 0.35;
    } else if (voiceMode === 'slap-bass') {
      osc1Gain.gain.value = 0.45;
      osc2Gain.gain.value = 0.28;
      subGain.gain.value = 0.42 + (this.knobs.k6SubMix / 127) * 0.35;
    } else if (voiceMode === 'picked-bass') {
      osc1Gain.gain.value = 0.44;
      osc2Gain.gain.value = 0.36;
      subGain.gain.value = 0.32 + (this.knobs.k6SubMix / 127) * 0.35;
    } else {
      // Fretless
      osc1Gain.gain.value = 0.42;
      osc2Gain.gain.value = 0.38;
      subGain.gain.value = 0.36 + (this.knobs.k6SubMix / 127) * 0.35;
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const targetCutoff = this.getCutoffHz();

    if (!isBassGuitar) {
      filter.frequency.setValueAtTime(Math.min(16000, targetCutoff * 1.45), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, targetCutoff), now + 0.16);
      filter.Q.setValueAtTime(this.getResonanceQ(), now);
    } else if (voiceMode === 'finger-bass') {
      // Warm plucked low-pass envelope
      const pluckPeak = Math.min(3400, Math.max(420, targetCutoff * 0.65));
      const sustainCutoff = Math.max(140, pluckPeak * 0.28);
      filter.frequency.setValueAtTime(pluckPeak, now);
      filter.frequency.exponentialRampToValueAtTime(sustainCutoff, now + 0.14);
      filter.Q.setValueAtTime(2.2 + (this.knobs.k2Resonance / 127) * 6, now);
    } else if (voiceMode === 'slap-bass') {
      // Aggressive slap & pop resonant filter snap
      const slapPeak = Math.min(7500, Math.max(1800, targetCutoff * 1.35));
      const sustainCutoff = Math.max(240, slapPeak * 0.22);
      filter.frequency.setValueAtTime(slapPeak, now);
      filter.frequency.exponentialRampToValueAtTime(sustainCutoff, now + 0.095);
      filter.Q.setValueAtTime(4.5 + (this.knobs.k2Resonance / 127) * 8, now);
    } else if (voiceMode === 'picked-bass') {
      // Bright plectrum bite decaying into gritty mid sustain
      const pickPeak = Math.min(5200, Math.max(1200, targetCutoff * 0.95));
      const sustainCutoff = Math.max(280, pickPeak * 0.38);
      filter.frequency.setValueAtTime(pickPeak, now);
      filter.frequency.exponentialRampToValueAtTime(sustainCutoff, now + 0.12);
      filter.Q.setValueAtTime(3.0 + (this.knobs.k2Resonance / 127) * 7, now);
    } else {
      // Fretless "mwah" swelling filter envelope
      const baseCut = Math.max(180, Math.min(1800, targetCutoff * 0.45));
      filter.frequency.setValueAtTime(baseCut * 0.55, now);
      filter.frequency.exponentialRampToValueAtTime(baseCut * 1.9, now + 0.19);
      filter.frequency.exponentialRampToValueAtTime(baseCut * 0.85, now + 0.65);
      filter.Q.setValueAtTime(5.2 + (this.knobs.k2Resonance / 127) * 8, now);
    }

    const vca = ctx.createGain();
    const velGain = (velocity / 127) * (isBassGuitar ? 0.56 : 0.42);
    const attackSec =
      voiceMode === 'fretless-bass'
        ? 0.018 + (this.knobs.k3Attack / 127) * 0.18
        : isBassGuitar
        ? 0.003 + (this.knobs.k3Attack / 127) * 0.08
        : 0.004 + Math.pow(this.knobs.k3Attack / 127, 2) * 0.65;

    vca.gain.setValueAtTime(0.0001, now);
    vca.gain.linearRampToValueAtTime(velGain, now + attackSec);
    if (isBassGuitar && voiceMode !== 'fretless-bass') {
      // Natural plucked string decay curve
      vca.gain.exponentialRampToValueAtTime(velGain * 0.58, now + attackSec + 0.22);
      vca.gain.exponentialRampToValueAtTime(velGain * 0.32, now + attackSec + 1.1);
    } else {
      vca.gain.exponentialRampToValueAtTime(velGain * 0.78, now + attackSec + 0.18);
    }

    // Add physical string attack transient (fret clank / pick click / finger thump)
    if (isBassGuitar) {
      this.triggerBassStringTransient(ctx, now, freq, velocity / 127, voiceMode);
    }

    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);
    subOsc.connect(subGain);

    osc1Gain.connect(filter);
    osc2Gain.connect(filter);
    subGain.connect(filter);

    filter.connect(vca);
    vca.connect(this.masterGain!);

    osc1.start(now);
    osc2.start(now);
    subOsc.start(now);

    this.activeVoices.set(midiNote, {
      midiNote,
      osc1,
      osc2,
      subOsc,
      filter,
      vca,
      baseFreq,
      osc2Ratio,
    });
  }

  private triggerBassStringTransient(
    ctx: AudioContext,
    now: number,
    freq: number,
    velNorm: number,
    mode: KeyboardVoiceMode
  ) {
    if (mode === 'slap-bass') {
      // Metallic thumb-slap & fret pop transient
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(freq * 7, now);
      popOsc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.024);
      popGain.gain.setValueAtTime(velNorm * 0.38, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      popOsc.connect(popGain);
      popGain.connect(this.masterGain!);
      popOsc.start(now);
      popOsc.stop(now + 0.032);

      if (this.noiseBuffer) {
        const fretNoise = ctx.createBufferSource();
        fretNoise.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(3200, now);
        bp.Q.setValueAtTime(2.5, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(velNorm * 0.28, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
        fretNoise.connect(bp);
        bp.connect(ng);
        ng.connect(this.masterGain!);
        fretNoise.start(now);
        fretNoise.stop(now + 0.022);
      }
    } else if (mode === 'picked-bass' && this.noiseBuffer) {
      // Crisp plectrum pick click
      const pickNoise = ctx.createBufferSource();
      pickNoise.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2100, now);
      bp.Q.setValueAtTime(1.8, now);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(velNorm * 0.25, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.014);
      pickNoise.connect(bp);
      bp.connect(ng);
      ng.connect(this.masterGain!);
      pickNoise.start(now);
      pickNoise.stop(now + 0.018);
    } else if (mode === 'finger-bass') {
      // Warm finger-pluck thump transient
      const thumpOsc = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(freq * 3.2, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(freq, now + 0.02);
      thumpGain.gain.setValueAtTime(velNorm * 0.24, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      thumpOsc.connect(thumpGain);
      thumpGain.connect(this.masterGain!);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.03);
    }
  }

  public noteOff(midiNote: number) {
    if (!this.ctx) return;
    const voice = this.activeVoices.get(midiNote);
    if (!voice) return;

    this.activeVoices.delete(midiNote);
    const now = this.ctx.currentTime;
    const releaseSec = 0.04 + Math.pow(this.knobs.k4Release / 127, 2) * 2.2;

    try {
      voice.vca.gain.cancelScheduledValues(now);
      voice.vca.gain.setValueAtTime(Math.max(0.0001, voice.vca.gain.value), now);
      voice.vca.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);

      const stopTime = now + releaseSec + 0.05;
      voice.osc1.stop(stopTime);
      voice.osc2.stop(stopTime);
      voice.subOsc.stop(stopTime);
    } catch {
      // Ignore already stopped oscillators
    }
  }

  public allNotesOff() {
    Array.from(this.activeVoices.keys()).forEach((note) => this.noteOff(note));
    this.activePadSources.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    this.activePadSources.clear();
  }

  public async loadCustomPadSample(padIndex: number, bank: 'A' | 'B', arrayBuffer: ArrayBuffer) {
    const ctx = this.ensureContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const key = `${this.currentProgram.id}-${bank}-${padIndex}`;
    this.customPadBuffers.set(key, audioBuffer);
  }

  /**
   * Triggers one of the 8 MPC pads (padIndex 0..7) in Bank A or B
   */
  public triggerPad(padIndex: number, bank: 'A' | 'B', velocity = 115) {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const vel = Math.max(0.15, Math.min(1, velocity / 127));
    const customKey = `${this.currentProgram.id}-${bank}-${padIndex}`;
    const customBuf = this.customPadBuffers.get(customKey);

    if (customBuf) {
      const prevSrc = this.activePadSources.get(customKey);
      if (prevSrc) {
        try {
          prevSrc.stop();
        } catch {
          // ignore
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = customBuf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vel * 0.9, now);
      src.connect(gain);
      gain.connect(this.masterGain!);
      src.start(now);
      this.activePadSources.set(customKey, src);
      return;
    }

    const slot = bank === 'A' ? padIndex : padIndex + 8;
    const progId = this.currentProgram.id;

    // Synthesize distinct drum/sample sound based on slot (0..15) and program tuning
    const pitchShift = progId === 2 ? 0.9 : progId === 3 ? 1.08 : progId === 4 ? 1.15 : 1.0;

    switch (slot) {
      case 0: // PAD 1 Bank A: Kick Drum
        this.playKick(ctx, now, vel, progId === 2 ? 42 : 52 * pitchShift, progId === 2 ? 0.55 : 0.32);
        break;
      case 1: // PAD 2 Bank A: Snare Drum
        this.playSnare(ctx, now, vel, 185 * pitchShift, progId === 4 ? 0.36 : 0.22);
        break;
      case 2: // PAD 3 Bank A: Closed Hi-Hat
        this.playHiHat(ctx, now, vel, 0.055, 7500 * pitchShift);
        break;
      case 3: // PAD 4 Bank A: Open Hi-Hat
        this.playHiHat(ctx, now, vel, 0.34, 6800 * pitchShift);
        break;
      case 4: // PAD 5 Bank A: Clap
        this.playClap(ctx, now, vel);
        break;
      case 5: // PAD 6 Bank A: Rimshot / Cowbell
        if (progId === 2) {
          this.playCowbell(ctx, now, vel);
        } else {
          this.playRimshot(ctx, now, vel, 420 * pitchShift);
        }
        break;
      case 6: // PAD 7 Bank A: P-Bass Slide Drop / 808 Glide / Picked Bass Riff
        if (progId === 1) {
          this.playBassGuitarLick(ctx, now, vel, 55.0, 'finger-slide');
        } else if (progId === 4) {
          this.playBassGuitarLick(ctx, now, vel, 65.41, 'picked');
        } else {
          this.playSubBassHit(ctx, now, vel, progId === 2 ? 36.7 : 48.9);
        }
        break;
      case 7: // PAD 8 Bank A: Chord Stab 1 (Minor 9th)
        this.playChordStab(ctx, now, vel, [261.63, 311.13, 392.0, 466.16, 587.33], progId);
        break;
      case 8: // PAD 1 Bank B: Shaker / Perc / Low Tom
        this.playTom(ctx, now, vel, 98 * pitchShift);
        break;
      case 9: // PAD 2 Bank B: Crash Cymbal / Mid Tom
        this.playCrash(ctx, now, vel);
        break;
      case 10: // PAD 3 Bank B: Low-Mid Tom
        this.playTom(ctx, now, vel, 130 * pitchShift);
        break;
      case 11: // PAD 4 Bank B: Hi Tom
        this.playTom(ctx, now, vel, 175 * pitchShift);
        break;
      case 12: // PAD 5 Bank B: Slap Bass Pop (Prog 1) / Brass / Acid Hit
        if (progId === 1) {
          this.playBassGuitarLick(ctx, now, vel, 73.42, 'slap-pop');
        } else {
          this.playChordStab(ctx, now, vel, [196.0, 293.66, 392.0, 493.88], progId);
        }
        break;
      case 13: // PAD 6 Bank B: Rhodes / Pluck 7th Chord
        this.playChordStab(ctx, now, vel, [293.66, 349.23, 440.0, 523.25, 659.25], progId);
        break;
      case 14: // PAD 7 Bank B: Funk Slap Bass (Prog 3) / Octave Bass Hit (Prog 4) / Laser FX
        if (progId === 3 || progId === 4) {
          this.playBassGuitarLick(ctx, now, vel, 55.0, 'slap-pop');
        } else {
          this.playLaserFX(ctx, now, vel);
        }
        break;
      case 15: // PAD 8 Bank B: High Soul / Synth Chord Stab
        this.playChordStab(ctx, now, vel, [349.23, 415.3, 523.25, 622.25, 783.99], progId);
        break;
    }
  }

  private playBassGuitarLick(
    ctx: AudioContext,
    now: number,
    vel: number,
    rootFreq: number,
    style: 'finger-slide' | 'slap-pop' | 'picked'
  ) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = style === 'finger-slide' ? 'triangle' : 'sawtooth';
    osc2.type = style === 'slap-pop' ? 'square' : 'sawtooth';
    sub.type = 'sine';

    if (style === 'finger-slide') {
      // Warm P-Bass fifth slide down to root
      osc1.frequency.setValueAtTime(rootFreq * 1.5, now);
      osc1.frequency.exponentialRampToValueAtTime(rootFreq, now + 0.14);
      osc2.frequency.setValueAtTime(rootFreq * 1.5, now);
      osc2.frequency.exponentialRampToValueAtTime(rootFreq, now + 0.14);
      sub.frequency.setValueAtTime(rootFreq * 0.75, now);
      sub.frequency.exponentialRampToValueAtTime(rootFreq * 0.5, now + 0.14);
    } else if (style === 'slap-pop') {
      // Funk octave slap -> pop
      osc1.frequency.setValueAtTime(rootFreq, now);
      osc1.frequency.setValueAtTime(rootFreq * 2, now + 0.11);
      osc2.frequency.setValueAtTime(rootFreq * 2, now);
      osc2.frequency.setValueAtTime(rootFreq * 4, now + 0.11);
      sub.frequency.setValueAtTime(rootFreq * 0.5, now);
    } else {
      // Picked bass octave groove hit
      osc1.frequency.setValueAtTime(rootFreq, now);
      osc2.frequency.setValueAtTime(rootFreq * 1.005, now);
      sub.frequency.setValueAtTime(rootFreq * 0.5, now);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(style === 'slap-pop' ? 4800 : 2400, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.42);
    filter.Q.setValueAtTime(style === 'slap-pop' ? 5.5 : 3.2, now);

    gain.gain.setValueAtTime(vel * 0.78, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    this.triggerBassStringTransient(
      ctx,
      now,
      rootFreq,
      vel,
      style === 'slap-pop' ? 'slap-bass' : style === 'picked' ? 'picked-bass' : 'finger-bass'
    );

    osc1.connect(filter);
    osc2.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start(now);
    osc2.start(now);
    sub.start(now);
    osc1.stop(now + 0.55);
    osc2.stop(now + 0.55);
    sub.stop(now + 0.55);
  }

  private playKick(ctx: AudioContext, now: number, vel: number, endFreq: number, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.075);
    osc.frequency.exponentialRampToValueAtTime(Math.max(28, endFreq * 0.75), now + duration);

    gain.gain.setValueAtTime(vel * 0.95, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Punch click transient
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(850, now);
    clickOsc.frequency.exponentialRampToValueAtTime(90, now + 0.02);
    clickGain.gain.setValueAtTime(vel * 0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    osc.connect(gain);
    clickOsc.connect(clickGain);
    gain.connect(this.masterGain!);
    clickGain.connect(this.masterGain!);

    osc.start(now);
    clickOsc.start(now);
    osc.stop(now + duration + 0.02);
    clickOsc.stop(now + 0.03);
  }

  private playSnare(ctx: AudioContext, now: number, vel: number, bodyFreq: number, noiseDecay: number) {
    // Tone body
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(bodyFreq * 1.4, now);
    osc.frequency.exponentialRampToValueAtTime(bodyFreq, now + 0.08);
    oscGain.gain.setValueAtTime(vel * 0.55, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    // Snare wires noise
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vel * 0.65, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDecay);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain!);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.16);
    noise.stop(now + noiseDecay + 0.02);
  }

  private playHiHat(ctx: AudioContext, now: number, vel: number, decay: number, cutoff: number) {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer!;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(cutoff, now);
    bandpass.Q.setValueAtTime(1.8, now);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(5500, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vel * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.masterGain!);

    noise.start(now);
    noise.stop(now + decay + 0.02);
  }

  private playClap(ctx: AudioContext, now: number, vel: number) {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer!;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, now);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    // Multi-burst clap envelope
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.011;
      gain.gain.setValueAtTime(vel * 0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.009);
    }
    gain.gain.setValueAtTime(vel * 0.7, now + 0.033);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start(now);
    noise.stop(now + 0.26);
  }

  private playRimshot(ctx: AudioContext, now: number, vel: number, freq: number) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2.35, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.8, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(vel * 0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.07);
    osc2.stop(now + 0.07);
  }

  private playCowbell(ctx: AudioContext, now: number, vel: number) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'square';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(540, now);
    osc2.frequency.setValueAtTime(800, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(680, now);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(vel * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }

  private playSubBassHit(ctx: AudioContext, now: number, vel: number, freq: number) {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.06);
    sub.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(95, now + 0.5);

    gain.gain.setValueAtTime(vel * 0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.68);
    sub.stop(now + 0.68);
  }

  private playTom(ctx: AudioContext, now: number, vel: number, freq: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.55, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.19);

    gain.gain.setValueAtTime(vel * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  private playCrash(ctx: AudioContext, now: number, vel: number) {
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer!;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vel * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start(now);
    noise.stop(now + 1.2);
  }

  private playLaserFX(ctx: AudioContext, now: number, vel: number) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.32);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(6, now);

    gain.gain.setValueAtTime(vel * 0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  private playChordStab(ctx: AudioContext, now: number, vel: number, freqs: number[], progId: number) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = this.getCutoffHz();
    filter.frequency.setValueAtTime(Math.min(12000, cutoff * 1.4), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(240, cutoff * 0.45), now + 0.42);
    filter.Q.setValueAtTime(3.2, now);

    const masterChordGain = ctx.createGain();
    masterChordGain.gain.setValueAtTime(vel * 0.16, now);
    masterChordGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    filter.connect(masterChordGain);
    masterChordGain.connect(this.masterGain!);

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = progId === 2 ? 'sine' : idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.detune.setValueAtTime((idx - 2) * 6, now);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + 0.58);
    });
  }
}

export const soundEngine = new SoundEngine();
