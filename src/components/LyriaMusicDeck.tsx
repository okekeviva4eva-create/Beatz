import React, { useRef, useState } from 'react';
import {
  Music,
  Wand2,
  Download,
  Repeat,
  ImagePlus,
  X,
  Loader2,
  Disc3,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { KnobParameters, ProgramPreset, soundEngine } from '../audio/soundEngine';

export type LyriaModelId = 'lyria-3-clip-preview' | 'lyria-3-pro-preview';

export interface GeneratedTrack {
  id: string;
  title: string;
  prompt: string;
  model: LyriaModelId;
  audioUrl: string;
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  lyrics: string;
  createdAt: string;
}

interface LyriaMusicDeckProps {
  program: ProgramPreset;
  bpm: number;
  swing: number;
  knobs: KnobParameters;
  padBank: 'A' | 'B';
  onAssignSampleToPad: (padIndex: number, bank: 'A' | 'B', label: string) => void;
  onStatusUpdate: (msg: string) => void;
}

const STUDIO_PROMPT_TEMPLATES = [
  {
    label: 'Funk Slap & P-Bass Guitar',
    prompt:
      'Generate a groovy funk and neo-soul electric bass guitar riff featuring vintage fingerstyle P-Bass lines, percussive thumb-slap jazz bass pops, and tight pocket drums at 108 BPM.',
  },
  {
    label: '90s MPC Boom-Bap Sample',
    prompt:
      'Generate a warm 90s dusty vinyl jazz-hop instrumental sample loop with Rhodes electric piano chords, upright bass, and crisp boom-bap drums at 94 BPM.',
  },
  {
    label: 'Melodic 808 Trap Backing',
    prompt:
      'Generate an atmospheric dark trap backing track with hypnotic bell arpeggios, deep booming 808 sub bass, and crisp rolling hi-hats at 140 BPM.',
  },
  {
    label: 'Warehouse 909 Deep House',
    prompt:
      'Generate a classic Chicago deep house groove with TR-909 drums, warm analog synth chords, and a squelchy resonant acid bassline at 124 BPM.',
  },
  {
    label: '80s Analog Synthwave',
    prompt:
      'Generate a nostalgic 1980s outrun synthwave track with lush Juno chorus pads, gated reverb LinnDrum snares, and driving arpeggiated bass at 112 BPM.',
  },
];

export const LyriaMusicDeck: React.FC<LyriaMusicDeckProps> = ({
  program,
  bpm,
  swing,
  knobs,
  padBank,
  onAssignSampleToPad,
  onStatusUpdate,
}) => {
  const [model, setModel] = useState<LyriaModelId>('lyria-3-clip-preview');
  const [prompt, setPrompt] = useState<string>(
    `Generate a 30-second ${program.category} instrumental backing loop at ${bpm} BPM with warm analog synths and punchy MPC drums.`
  );
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tracks, setTracks] = useState<GeneratedTrack[]>([]);
  const [loopPlayback, setLoopPlayback] = useState<boolean>(true);
  const [selectedPadTarget, setSelectedPadTarget] = useState<number>(7); // Default PAD 8
  const [assignedFeedback, setAssignedFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncPromptFromHardware = () => {
    const filterCharacter =
      knobs.k1Cutoff > 90
        ? 'bright open filter'
        : knobs.k1Cutoff < 45
        ? 'deep muted low-pass filter'
        : 'warm resonant filter';
    const spaceCharacter =
      knobs.k8ReverbMix > 55 ? 'lush atmospheric reverb' : 'tight studio room sound';
    const clipType =
      model === 'lyria-3-clip-preview' ? '30-second sample loop' : 'full-length studio track';

    const synced = `Generate a ${clipType} in the style of ${program.category} (${program.name}) at ${bpm} BPM with ${swing}% swing, featuring ${filterCharacter} and ${spaceCharacter}.`;
    setPrompt(synced);
    onStatusUpdate(`LYRIA PROMPT SYNCED (${bpm} BPM · ${program.category.toUpperCase()})`);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      const [header, base64Data] = dataUrl.split(',');
      const mimeMatch = header.match(/data:(.*?);base64/);
      setImageBase64(base64Data);
      setImageMimeType(mimeMatch ? mimeMatch[1] : file.type || 'image/jpeg');
      onStatusUpdate(`IMAGE ATTACHED FOR LYRIA MULTIMODAL GENERATION`);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setImageMimeType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerateMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);
    onStatusUpdate(
      `LYRIA 3 (${model === 'lyria-3-clip-preview' ? 'CLIP 30S' : 'PRO FULL'}): GENERATING AUDIO...`
    );

    try {
      const response = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageMimeType || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Generation failed (${response.status})`);
      }

      const { audioBase64, mimeType = 'audio/wav', lyrics = '' } = data;

      // Decode base64 audio into a playable Blob URL (per Lyria skill instructions)
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);

      const newTrack: GeneratedTrack = {
        id: `${Date.now()}`,
        title:
          prompt.trim().slice(0, 48) + (prompt.trim().length > 48 ? '...' : ''),
        prompt: prompt.trim(),
        model,
        audioUrl,
        arrayBuffer: bytes.buffer.slice(0),
        mimeType,
        lyrics,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setTracks((prev) => [newTrack, ...prev]);
      onStatusUpdate(`LYRIA TRACK READY · CLICK PLAY OR ASSIGN TO PAD`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to generate music. Make sure a paid Gemini API key is configured.';
      setErrorMessage(msg);
      onStatusUpdate(`LYRIA ERROR: CHECK API KEY`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAssignTrackToPad = async (track: GeneratedTrack) => {
    try {
      await soundEngine.loadCustomPadSample(selectedPadTarget, padBank, track.arrayBuffer);
      const shortLabel = `Lyria: ${track.prompt.slice(0, 18)}`;
      onAssignSampleToPad(selectedPadTarget, padBank, shortLabel);
      setAssignedFeedback(`Loaded onto PAD ${selectedPadTarget + 1} (Bank ${padBank})`);
      onStatusUpdate(`LYRIA SAMPLE LOADED TO PAD ${selectedPadTarget + 1} [BANK ${padBank}]`);
      setTimeout(() => setAssignedFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to decode audio onto pad:', err);
      setErrorMessage('Could not decode audio buffer for MPC pad assignment.');
    }
  };

  return (
    <section className="w-full bg-[#16181d] border border-zinc-800/90 rounded-xl p-5 shadow-xl flex flex-col gap-4">
      {/* Header Row: Title & Model Selector (Lyria Clip vs Lyria Pro) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600/15 border border-red-500/40 flex items-center justify-center text-red-400">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-white tracking-tight">
              Lyria 3 AI Backing Track &amp; MPC Sample Generator
            </h2>
            <p className="text-xs text-zinc-400">
              Generate custom studio backing tracks or 30-second sample stems to jam over or load directly onto the AKAI MPK mini pads.
            </p>
          </div>
        </div>

        {/* Interactive Segmented Control: lyria-3-clip-preview vs lyria-3-pro-preview */}
        <div className="flex items-center gap-1 p-1 bg-[#0e1014] border border-zinc-800 rounded-lg">
          <button
            type="button"
            onClick={() => setModel('lyria-3-clip-preview')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              model === 'lyria-3-clip-preview'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Lyria Clip (30s Loop · lyria-3-clip-preview)
          </button>
          <button
            type="button"
            onClick={() => setModel('lyria-3-pro-preview')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              model === 'lyria-3-pro-preview'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Lyria Pro (Full Track · lyria-3-pro-preview)
          </button>
        </div>
      </div>

      {/* Prompt Builder Form */}
      <form onSubmit={handleGenerateMusic} className="flex flex-col gap-3">
        {/* Preset Template Buttons + Hardware Sync Button */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-400 mr-1">Quick Styles:</span>
            {STUDIO_PROMPT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => setPrompt(tpl.prompt)}
                className="px-2.5 py-1 rounded bg-[#111317] hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={syncPromptFromHardware}
            className="px-3 py-1 rounded bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Wand2 className="w-3.5 h-3.5 text-red-400" />
            <span>Sync Prompt with MPK Hardware ({bpm} BPM)</span>
          </button>
        </div>

        {/* Textarea + Optional Image Inspiration Attachment + Generate CTA */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <div className="flex-1 relative flex flex-col">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the music clip, genre, instruments, tempo, or mood..."
              className="w-full h-full bg-[#0d0f13] border border-zinc-800 focus:border-red-500 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none"
            />
          </div>

          {/* Optional Image Inspiration Upload + Generate Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative h-full min-h-[56px] w-20 rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900 shrink-0">
                <img
                  src={imagePreview}
                  alt="Music inspiration"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  title="Remove image"
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-red-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach an image to inspire Lyria music generation"
                className="h-full min-h-[56px] px-3.5 rounded-lg bg-[#0d0f13] hover:bg-zinc-800/80 border border-zinc-800 text-xs font-medium text-zinc-300 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ImagePlus className="w-4 h-4 text-zinc-400" />
                <span>Add Image</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="h-full min-h-[56px] px-5 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(220,38,38,0.35)] cursor-pointer whitespace-nowrap shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Track...</span>
                </>
              ) : (
                <>
                  <Disc3 className="w-4 h-4" />
                  <span>Generate Music</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-950/50 border border-red-800/80 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pad Assignment Confirmation */}
      {assignedFeedback && (
        <div className="bg-emerald-950/50 border border-emerald-700/70 rounded-lg px-4 py-2 flex items-center gap-2 text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{assignedFeedback} — Strike the pad on the MPK mini above to trigger your Lyria sample!</span>
        </div>
      )}

      {/* Generated Tracks List & MPC Pad Loader */}
      {tracks.length > 0 && (
        <div className="flex flex-col gap-2.5 pt-2 border-t border-zinc-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <span>Generated Studio Stems ({tracks.length})</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setLoopPlayback((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer ${
                  loopPlayback ? 'bg-red-600/20 text-red-300 border border-red-500/40' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Repeat className="w-3 h-3" />
                <span>Loop Player: {loopPlayback ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Target MPC Pad Selector for Sample Assignment */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400">Target MPC Pad (Bank {padBank}):</span>
              <select
                value={selectedPadTarget}
                onChange={(e) => setSelectedPadTarget(Number(e.target.value))}
                className="bg-[#0d0f13] border border-zinc-700 rounded px-2 py-1 text-xs font-mono-tabular text-zinc-200 focus:outline-none focus:border-red-500"
              >
                {Array.from({ length: 8 }, (_, idx) => (
                  <option key={idx} value={idx}>
                    PAD {idx + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="bg-[#0f1116] border border-zinc-800 rounded-lg p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono-tabular">
                      <span>{track.model === 'lyria-3-clip-preview' ? 'Lyria Clip (30s)' : 'Lyria Pro'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{track.createdAt}</span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-100 mt-0.5 line-clamp-2" title={track.prompt}>
                      {track.prompt}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAssignTrackToPad(track)}
                      className="px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Load to PAD {selectedPadTarget + 1}
                    </button>
                    <a
                      href={track.audioUrl}
                      download={`lyria-${track.id}.wav`}
                      title="Download WAV"
                      className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Native HTML5 Audio Player for jamming over the track */}
                <audio
                  controls
                  loop={loopPlayback}
                  src={track.audioUrl}
                  className="w-full h-8 accent-red-600"
                />

                {/* Generated Lyrics / Metadata if returned by Lyria */}
                {track.lyrics && (
                  <div className="bg-[#090a0d] border border-zinc-800/80 rounded px-2.5 py-2 text-[11px] text-zinc-300 max-h-24 overflow-y-auto whitespace-pre-wrap font-mono-tabular">
                    {track.lyrics}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
