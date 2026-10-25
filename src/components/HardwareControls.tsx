import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';

export interface HoveredControlInfo {
  title: string;
  func: string;
  shortcut?: string;
  state?: string;
  rect: {
    top: number;
    left: number;
    width: number;
    height: number;
    bottom: number;
  };
}

export const HardwareHoverCallout: React.FC<{ info: HoveredControlInfo | null }> = ({ info }) => {
  if (!info) return null;

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const cardWidth = 280;
  const centerX = info.rect.left + info.rect.width / 2;
  const clampedLeft = Math.max(12, Math.min(viewportW - cardWidth - 12, centerX - cardWidth / 2));
  const showBelow = info.rect.top < 110;
  const topPos = showBelow ? info.rect.bottom + 10 : info.rect.top - 10;

  return (
    <div
      style={{
        left: `${clampedLeft}px`,
        top: `${topPos}px`,
        width: `${cardWidth}px`,
        transform: showBelow ? 'translateY(0)' : 'translateY(-100%)',
      }}
      className="fixed z-50 pointer-events-none select-none rounded-lg bg-[#0c0d10]/95 backdrop-blur-md border border-red-500/70 shadow-[0_12px_30px_rgba(0,0,0,0.9),0_0_16px_rgba(239,68,68,0.3)] px-3 py-2 text-left transition-opacity duration-75"
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/90 pb-1 mb-1">
        <span className="text-[11px] font-mono-tabular font-extrabold uppercase tracking-wider text-red-400 truncate">
          {info.title}
        </span>
        {info.shortcut && (
          <span className="text-[9.5px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 shrink-0">
            {info.shortcut}
          </span>
        )}
      </div>

      <p className="text-[11px] text-zinc-200 leading-snug font-medium">
        {info.func}
      </p>

      {info.state && (
        <div className="mt-1.5 pt-1 border-t border-zinc-800/70 flex items-center justify-between text-[10px] font-mono-tabular">
          <span className="text-zinc-400">STATUS</span>
          <span className="text-white font-bold">{info.state}</span>
        </div>
      )}
    </div>
  );
};

interface ThumbstickProps {
  pitch: number; // -1 to 1
  mod: number;   // -1 to 1
  onChange: (pitch: number, mod: number) => void;
}

export const RedThumbstick: React.FC<ThumbstickProps> = ({ pitch, mod, onChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.38;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const normX = (Math.cos(angle) * clampedDist) / maxRadius;
    const normY = -(Math.sin(angle) * clampedDist) / maxRadius; // Up is +1

    onChange(Number(normX.toFixed(2)), Number(normY.toFixed(2)));
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      updateFromPointer(e.clientX, e.clientY);
    };
    const handleUp = (e: PointerEvent) => {
      setDragging(false);
      // Hold shift to lock thumbstick position, otherwise spring back to center
      if (!e.shiftKey) {
        onChange(0, 0);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging]);

  const offsetX = pitch * 14;
  const offsetY = -mod * 14;

  return (
    <div className="flex flex-col items-center group">
      <div
        ref={containerRef}
        data-hw-title="4-WAY PITCH / MOD THUMBSTICK"
        data-hw-func="Drag Left/Right (X-Axis) to bend synth pitch up or down. Drag Up/Down (Y-Axis) to sweep filter modulation & vibrato. Hold Shift while releasing to lock position."
        data-hw-shortcut="Drag / Shift+Lock"
        data-hw-state={`PITCH ${pitch >= 0 ? '+' : ''}${Math.round(pitch * 100)}% · MOD ${Math.round(mod * 100)}%`}
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
          updateFromPointer(e.clientX, e.clientY);
        }}
        className="relative w-16 h-16 rounded-full bg-[#0d0e11] border-2 border-zinc-700/80 hover:border-red-500 transition-all shadow-[inset_0_4px_10px_rgba(0,0,0,0.95),0_2px_4px_rgba(255,255,255,0.06)] hover:shadow-[0_0_16px_rgba(239,68,68,0.55),inset_0_4px_10px_rgba(0,0,0,0.95)] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        {/* Inner socket ring */}
        <div className="w-12 h-12 rounded-full border border-zinc-800 group-hover:border-red-500/40 bg-radial from-zinc-900 to-black transition-colors" />

        {/* Red AKAI Thumbstick Cap */}
        <div
          style={{
            transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
          }}
          className="absolute w-11 h-11 rounded-full transition-transform duration-75 ease-out flex items-center justify-center"
        >
          {/* Outer red bevel */}
          <div className="w-full h-full rounded-full bg-gradient-to-b from-[#ff3b30] via-[#dc2626] to-[#991b1b] group-hover:from-[#ff584d] group-hover:via-[#ef4444] group-hover:to-[#b91c1c] shadow-[0_6px_12px_rgba(0,0,0,0.85),inset_0_2px_3px_rgba(255,255,255,0.45)] flex items-center justify-center p-1.5">
            {/* Concave inner dish */}
            <div className="w-full h-full rounded-full bg-gradient-to-b from-[#b91c1c] via-[#dc2626] to-[#ef4444] shadow-[inset_0_3px_6px_rgba(0,0,0,0.65)] border border-red-400/30" />
          </div>
        </div>
      </div>
    </div>
  );
};

interface RotaryKnobProps {
  id: string;
  label: string;
  paramLabel: string;
  paramDescription?: string;
  value: number; // 0..127
  defaultValue: number;
  onChange: (val: number) => void;
  onFocusParam: (info: string) => void;
}

const KNOB_DESCRIPTIONS: Record<string, string> = {
  K1: 'Controls Low-Pass Filter Cutoff frequency (brightens or darkens the synth timbre).',
  K2: 'Controls Filter Resonance peak emphasis around the cutoff frequency.',
  K3: 'Controls Envelope Attack time (how quickly notes fade in from 0 to full volume).',
  K4: 'Controls Envelope Release time (how long notes ring out after releasing a key).',
  K5: 'Controls Dual-Oscillator Detune spread for thick analog chorus width.',
  K6: 'Controls Sub-Oscillator (-1 Octave) level for deep low-end bass weight.',
  K7: 'Controls Stereo Dub Delay wet/dry mix level.',
  K8: 'Controls Studio Hall Reverb wet/dry ambience level.',
};

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  id,
  paramLabel,
  paramDescription,
  value,
  defaultValue,
  onChange,
  onFocusParam,
}) => {
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);
  const [isDragging, setIsDragging] = useState(false);

  // Map 0..127 to -135deg .. +135deg
  const angle = -135 + (value / 127) * 270;

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const sensitivity = e.shiftKey ? 0.35 : 0.9;
      const nextVal = Math.max(0, Math.min(127, Math.round(startValRef.current + deltaY * sensitivity)));
      onChange(nextVal);
      onFocusParam(`${id} (${paramLabel}): ${nextVal}`);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, id, paramLabel, onChange, onFocusParam]);

  // 11 tick marks from -135 deg to +135 deg
  const ticks = Array.from({ length: 11 }, (_, i) => -135 + i * 27);
  const description = paramDescription || KNOB_DESCRIPTIONS[id] || `Adjusts ${paramLabel} parameter (0–127).`;

  return (
    <div
      data-hw-title={`KNOB ${id} · ${paramLabel.toUpperCase()}`}
      data-hw-func={`${description} Drag up/down, scroll mouse wheel, or double-click to reset to default (${defaultValue}).`}
      data-hw-shortcut="Drag / Scroll / Dbl-Click"
      data-hw-state={`VALUE: ${value} / 127 (${Math.round((value / 127) * 100)}%)`}
      className="flex flex-col items-center select-none group rounded-lg p-0.5 transition-all hover:bg-red-500/10 hover:ring-1 hover:ring-red-500/50"
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          startYRef.current = e.clientY;
          startValRef.current = value;
          setIsDragging(true);
          onFocusParam(`${id} (${paramLabel}): ${value}`);
        }}
        onDoubleClick={() => {
          onChange(defaultValue);
          onFocusParam(`${id} (${paramLabel}): ${defaultValue} [Reset]`);
        }}
        onWheel={(e) => {
          e.preventDefault();
          const step = e.deltaY < 0 ? 4 : -4;
          const next = Math.max(0, Math.min(127, value + step));
          onChange(next);
          onFocusParam(`${id} (${paramLabel}): ${next}`);
        }}
        className="relative w-16 h-16 flex items-center justify-center cursor-ns-resize touch-none"
      >
        {/* SVG Tick Marks & MIN/MAX labels */}
        <svg viewBox="0 0 68 68" className="absolute inset-0 w-full h-full pointer-events-none">
          {ticks.map((deg, idx) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const x1 = 34 + Math.cos(rad) * 25;
            const y1 = 34 + Math.sin(rad) * 25;
            const x2 = 34 + Math.cos(rad) * 29;
            const y2 = 34 + Math.sin(rad) * 29;
            const isLit = (value / 127) * 10 >= idx;
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isLit ? '#f87171' : '#71717a'}
                strokeWidth={idx === 0 || idx === 5 || idx === 10 ? '1.8' : '1.2'}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Outer Dark Skirt */}
        <div className="w-11 h-11 rounded-full bg-gradient-to-b from-[#2c2e33] to-[#121316] shadow-[0_5px_10px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] group-hover:shadow-[0_0_12px_rgba(239,68,68,0.55),inset_0_1px_1px_rgba(255,255,255,0.25)] border border-zinc-700/80 group-hover:border-red-400 transition-all flex items-center justify-center">
          {/* Inner Rotary Cap */}
          <div
            style={{ transform: `rotate(${angle}deg)` }}
            className="relative w-8 h-8 rounded-full bg-gradient-to-b from-[#383a40] via-[#222428] to-[#16171a] shadow-[inset_0_2px_3px_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.9)] border border-zinc-600/60 group-hover:border-red-400/60"
          >
            {/* White Indicator Line */}
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-[2.5px] h-3.5 rounded-full bg-white group-hover:bg-red-400 shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
          </div>
        </div>

        {/* MIN / MAX silkscreen micro-labels */}
        <span className="absolute bottom-0.5 left-1 text-[6.5px] font-bold tracking-tighter text-zinc-400 group-hover:text-zinc-200">
          MIN
        </span>
        <span className="absolute bottom-0.5 right-1 text-[6.5px] font-bold tracking-tighter text-zinc-400 group-hover:text-zinc-200">
          MAX
        </span>
      </div>

      {/* Hardware Silkscreen K1..K8 + Subtle Parameter subtitle */}
      <div className="flex flex-col items-center -mt-1">
        <span className="text-[10px] font-extrabold tracking-wider text-zinc-200 group-hover:text-white leading-none">
          {id}
        </span>
        <span className="text-[9px] font-medium text-zinc-400 group-hover:text-red-400 transition-colors leading-tight mt-0.5">
          {paramLabel}
        </span>
      </div>
    </div>
  );
};

export const StudioOscilloscope: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number;
    const buffer = new Uint8Array(512);

    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const analyser = soundEngine.getAnalyser();
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Subtle grid line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          if (analyser) {
            analyser.getByteTimeDomainData(buffer);
          } else {
            buffer.fill(128);
          }

          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.75;
          ctx.beginPath();

          const sliceWidth = w / buffer.length;
          let x = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = buffer[i] / 128.0;
            const y = (v * h) / 2;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }
          ctx.stroke();
        }
      }
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={34}
      data-hw-title="MASTER AUDIO OSCILLOSCOPE"
      data-hw-func="Real-time waveform analyzer showing live synthesis, MPC drum pad transients, and Lyria 3 audio output."
      data-hw-state="LIVE SIGNAL MONITOR"
      className="rounded bg-[#0b0c0e] border border-zinc-800 hover:border-red-500/60 transition-colors shadow-inner cursor-help"
    />
  );
};

