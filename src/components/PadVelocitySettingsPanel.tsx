import React from 'react';
import { Sliders, Activity, Zap, Lock, RotateCcw, Volume2 } from 'lucide-react';

export type PadVelocityCurve = 'linear' | 'exponential' | 'fixed';

export interface PadVelocityConfig {
  curve: PadVelocityCurve;
  minVelocity: number;     // 20..110 (floor for linear/exponential)
  maxVelocity: number;     // 90..127 (ceiling for linear/exponential)
  expExponent: number;     // 1.4..3.5 (curviness for exponential)
  fixedVelocity: number;   // 1..127 (used when curve === 'fixed')
}

export interface LastPadHitTelemetry {
  padIndex: number;
  padName: string;
  rawInputNorm: number;    // 0..1 (vertical strike position or key input)
  outputVelocity: number;  // 1..127 after curve mapping
  timestamp: number;
}

export const DEFAULT_PAD_VELOCITY_CONFIG: PadVelocityConfig = {
  curve: 'linear',
  minVelocity: 45,
  maxVelocity: 127,
  expExponent: 2.2,
  fixedVelocity: 110,
};

/**
 * Maps a normalized pad strike input (0.0 = lightest/top edge, 1.0 = hardest/bottom edge)
 * to a MIDI velocity (1..127) according to the active PadVelocityConfig and hardware FULL LEVEL state.
 */
export function computePadVelocity(
  rawInputNorm: number,
  config: PadVelocityConfig,
  fullLevelActive: boolean
): number {
  if (fullLevelActive) {
    return 127;
  }

  const clampedIn = Math.max(0, Math.min(1, rawInputNorm));

  if (config.curve === 'fixed') {
    return Math.max(1, Math.min(127, Math.round(config.fixedVelocity)));
  }

  const minV = Math.max(1, Math.min(126, config.minVelocity));
  const maxV = Math.max(minV + 1, Math.min(127, config.maxVelocity));

  if (config.curve === 'exponential') {
    const curved = Math.pow(clampedIn, config.expExponent);
    return Math.max(1, Math.min(127, Math.round(minV + curved * (maxV - minV))));
  }

  // 'linear'
  return Math.max(1, Math.min(127, Math.round(minV + clampedIn * (maxV - minV))));
}

interface PadVelocitySettingsPanelProps {
  config: PadVelocityConfig;
  fullLevel: boolean;
  lastHit: LastPadHitTelemetry | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onChangeConfig: (next: PadVelocityConfig) => void;
  onToggleFullLevel: () => void;
  onTestStrike: (rawInputNorm: number) => void;
}

export const PadVelocitySettingsPanel: React.FC<PadVelocitySettingsPanelProps> = ({
  config,
  fullLevel,
  lastHit,
  isOpen,
  onToggleOpen,
  onChangeConfig,
  onToggleFullLevel,
  onTestStrike,
}) => {
  // Generate SVG polyline points for the active velocity transfer curve (0..1 -> 1..127)
  const svgWidth = 220;
  const svgHeight = 112;
  const padX = 24;
  const padY = 12;
  const plotW = svgWidth - padX - 10;
  const plotH = svgHeight - padY - 18;

  const points: string[] = [];
  const areaPoints: string[] = [];

  for (let i = 0; i <= 32; i++) {
    const normX = i / 32;
    const velY = computePadVelocity(normX, config, fullLevel);
    const x = padX + normX * plotW;
    const y = padY + plotH - ((velY - 1) / 126) * plotH;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    areaPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const areaPolygon = [
    `${padX},${padY + plotH}`,
    ...areaPoints,
    `${padX + plotW},${padY + plotH}`,
  ].join(' ');

  // Coordinates of the last pad hit on the curve graph
  const activeNormX = lastHit ? Math.max(0, Math.min(1, lastHit.rawInputNorm)) : 0.72;
  const activeVelY = lastHit
    ? lastHit.outputVelocity
    : computePadVelocity(activeNormX, config, fullLevel);
  const hitDotX = padX + activeNormX * plotW;
  const hitDotY = padY + plotH - ((activeVelY - 1) / 126) * plotH;

  const curveOptions: {
    id: PadVelocityCurve;
    label: string;
    badge: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'linear',
      label: 'Linear',
      badge: '1:1 NATURAL',
      desc: 'Even, proportional velocity response from top to bottom of the MPC drum pads. Ideal for balanced finger drumming.',
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    {
      id: 'exponential',
      label: 'Exponential',
      badge: 'DYNAMIC PUNCH',
      desc: 'Curved sensitivity that keeps light taps subtle for delicate ghost notes while hard hits ramp steeply to 127.',
      icon: <Zap className="w-3.5 h-3.5" />,
    },
    {
      id: 'fixed',
      label: 'Fixed',
      badge: 'CONSTANT VEL',
      desc: 'Locks all 8 MPC drum pads to a constant custom MIDI velocity (1–127) regardless of strike position.',
      icon: <Lock className="w-3.5 h-3.5" />,
    },
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <section
      aria-label="MPC Drum Pad Velocity Curve & Sensitivity Settings"
      className="w-full bg-[#15171c] border border-zinc-800/90 rounded-xl p-4 shadow-xl transition-all"
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
          <Sliders className="w-4 h-4 text-red-400" />
          <h2 className="text-xs font-extrabold tracking-wider uppercase text-zinc-100">
            MPC Drum Pad Sensitivity &amp; Velocity Curve Settings
          </h2>
          <span className="text-[10px] font-mono-tabular px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-300 font-semibold">
            {fullLevel
              ? 'OVERRIDE: FULL LEVEL (127)'
              : `ACTIVE: ${config.curve.toUpperCase()} CURVE`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-hw-title="RESET PAD VELOCITY SETTINGS"
            data-hw-func="Restores the MPC drum pad sensitivity curve, minimum velocity floor, and exponent back to factory studio defaults."
            data-hw-state="FACTORY DEFAULT"
            onClick={() => onChangeConfig({ ...DEFAULT_PAD_VELOCITY_CONFIG })}
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={onToggleOpen}
            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] font-semibold text-zinc-400 hover:text-white cursor-pointer transition-colors"
          >
            Hide Panel
          </button>
        </div>
      </div>

      {/* Main 3-Column Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* COLUMN 1 (4 cols): 3 Velocity Curve Mode Cards (Linear / Exponential / Fixed) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-2">
          <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-zinc-400 font-bold mb-0.5">
            1. Select Velocity Response Curve
          </div>

          <div className="grid grid-cols-1 gap-2">
            {curveOptions.map((opt) => {
              const isSelected = config.curve === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-hw-title={`PAD VELOCITY CURVE · ${opt.label.toUpperCase()}`}
                  data-hw-func={opt.desc}
                  data-hw-state={isSelected ? 'ACTIVE CURVE' : 'CLICK TO SELECT'}
                  onClick={() => onChangeConfig({ ...config, curve: opt.id })}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'bg-[#251519] border-red-500/80 text-white shadow-[0_0_12px_rgba(239,68,68,0.22)]'
                      : 'bg-[#101216] border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/70'
                  }`}
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-md border ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-400'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold tracking-tight text-white">
                        {opt.label}
                      </span>
                      <span
                        className={`text-[9px] font-mono-tabular font-bold px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-red-500/25 text-red-300 border border-red-500/40'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-zinc-400 leading-snug mt-1">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2 (4 cols): Live SVG Transfer Curve Graph & Audition Tester */}
        <div className="lg:col-span-4 bg-[#0f1014] border border-zinc-800/90 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-zinc-400 font-bold">
              2. Live Transfer Curve (Input → MIDI Vel)
            </span>
            <span className="text-[10px] font-mono-tabular text-red-400 font-bold">
              OUT: {activeVelY} / 127
            </span>
          </div>

          {/* SVG Transfer Function Plot */}
          <div className="my-2 flex items-center justify-center bg-[#090a0d] border border-zinc-800/80 rounded p-1.5">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-28 overflow-visible select-none"
            >
              <defs>
                <linearGradient id="velCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines (Velocity 127, 64, 1) */}
              {[0, 0.5, 1].map((g, idx) => {
                const y = padY + g * plotH;
                const label = idx === 0 ? '127' : idx === 1 ? '64' : '1';
                return (
                  <g key={idx}>
                    <line
                      x1={padX}
                      y1={y}
                      x2={padX + plotW}
                      y2={y}
                      stroke="#27272a"
                      strokeDasharray={idx === 1 ? '3 3' : undefined}
                      strokeWidth="1"
                    />
                    <text
                      x={padX - 4}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-zinc-500 text-[8px] font-mono"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Grid Lines (Soft, Med, Hard Strike) */}
              {[0, 0.5, 1].map((g, idx) => {
                const x = padX + g * plotW;
                const label = idx === 0 ? 'SOFT' : idx === 1 ? 'MED' : 'HARD';
                return (
                  <g key={idx}>
                    <line
                      x1={x}
                      y1={padY}
                      x2={x}
                      y2={padY + plotH}
                      stroke="#27272a"
                      strokeDasharray={idx === 1 ? '3 3' : undefined}
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={svgHeight - 3}
                      textAnchor={idx === 0 ? 'start' : idx === 2 ? 'end' : 'middle'}
                      className="fill-zinc-500 text-[7.5px] font-mono"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Shaded Area under Curve */}
              <polygon points={areaPolygon} fill="url(#velCurveGrad)" />

              {/* Active Curve Polyline */}
              <polyline
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points.join(' ')}
              />

              {/* Active Strike Crosshair & Dot */}
              <line
                x1={hitDotX}
                y1={padY}
                x2={hitDotX}
                y2={padY + plotH}
                stroke="#f87171"
                strokeOpacity="0.35"
                strokeDasharray="2 2"
              />
              <circle
                cx={hitDotX}
                cy={hitDotY}
                r="4.2"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* Quick Audition Strike Buttons (Soft / Medium / Hard) */}
          <div className="flex items-center justify-between gap-1.5 pt-1">
            <span className="text-[10px] font-mono-tabular text-zinc-400 flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-red-400" />
              Audition Hit:
            </span>
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Ghost (20%)', norm: 0.2 },
                { label: 'Med (55%)', norm: 0.55 },
                { label: 'Hard (95%)', norm: 0.95 },
              ].map((test) => (
                <button
                  key={test.label}
                  type="button"
                  data-hw-title={`AUDITION PAD STRIKE (${test.label.toUpperCase()})`}
                  data-hw-func={`Simulates striking Pad 1 at ${Math.round(
                    test.norm * 100
                  )}% force through the active ${config.curve.toUpperCase()} velocity curve (Output: Velocity ${computePadVelocity(
                    test.norm,
                    config,
                    fullLevel
                  )}).`}
                  data-hw-state={`VEL ${computePadVelocity(test.norm, config, fullLevel)}`}
                  onClick={() => onTestStrike(test.norm)}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-red-600/25 border border-zinc-700/80 hover:border-red-500/60 text-[10px] font-mono-tabular font-semibold text-zinc-200 hover:text-white cursor-pointer transition-all"
                >
                  {test.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMN 3 (4 cols): Curve Sensitivity Sliders & Last Strike Telemetry */}
        <div className="lg:col-span-4 bg-[#0f1014] border border-zinc-800/90 rounded-lg p-3 flex flex-col justify-between gap-3">
          <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-zinc-400 font-bold">
            3. Sensitivity &amp; Threshold Calibration
          </div>

          {config.curve === 'fixed' ? (
            /* FIXED VELOCITY CONTROLS */
            <div className="flex flex-col gap-3 my-auto">
              <div
                data-hw-title="FIXED PAD VELOCITY LEVEL"
                data-hw-func="Sets the exact MIDI velocity (1–127) sent every time an MPC drum pad is triggered in Fixed Curve mode."
                data-hw-state={`FIXED VELOCITY: ${config.fixedVelocity}`}
                className="bg-[#15171d] border border-zinc-800 rounded-lg p-2.5"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-zinc-200">Fixed Velocity Level</span>
                  <span className="font-mono-tabular font-bold text-red-400">
                    {config.fixedVelocity} / 127
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={127}
                  value={config.fixedVelocity}
                  onChange={(e) =>
                    onChangeConfig({ ...config, fixedVelocity: Number(e.target.value) })
                  }
                  className="w-full accent-red-600 cursor-pointer"
                />
                <div className="flex items-center justify-between gap-1.5 mt-2">
                  {[
                    { label: 'Ghost (55)', val: 55 },
                    { label: 'Groove (92)', val: 92 },
                    { label: 'Punch (112)', val: 112 },
                    { label: 'Max (127)', val: 127 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => onChangeConfig({ ...config, fixedVelocity: preset.val })}
                      className={`flex-1 py-1 rounded text-[10px] font-mono-tabular font-semibold border cursor-pointer transition-colors ${
                        config.fixedVelocity === preset.val
                          ? 'bg-red-600 text-white border-red-400'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* LINEAR & EXPONENTIAL DYNAMIC RANGE CONTROLS */
            <div className="flex flex-col gap-2.5 my-auto">
              {/* Minimum Velocity Floor (Softest Top-of-Pad Hit) */}
              <div
                data-hw-title="MINIMUM VELOCITY FLOOR (SOFT HIT)"
                data-hw-func="Sets the lowest velocity produced when tapping lightly near the top edge of an MPC drum pad."
                data-hw-state={`MIN FLOOR: ${config.minVelocity}`}
                className="bg-[#15171d] border border-zinc-800 rounded-lg px-2.5 py-2"
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-zinc-300">Soft Hit Floor (Top of Pad)</span>
                  <span className="font-mono-tabular font-bold text-red-400">
                    VEL {config.minVelocity}
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={105}
                  value={config.minVelocity}
                  onChange={(e) => {
                    const nextMin = Number(e.target.value);
                    onChangeConfig({
                      ...config,
                      minVelocity: nextMin,
                      maxVelocity: Math.max(nextMin + 10, config.maxVelocity),
                    });
                  }}
                  className="w-full accent-red-600 cursor-pointer"
                />
              </div>

              {/* Maximum Velocity Ceiling (Hardest Bottom-of-Pad Hit) */}
              <div
                data-hw-title="MAXIMUM VELOCITY CEILING (HARD HIT)"
                data-hw-func="Sets the peak velocity reached when striking firmly near the bottom of an MPC drum pad."
                data-hw-state={`MAX CEILING: ${config.maxVelocity}`}
                className="bg-[#15171d] border border-zinc-800 rounded-lg px-2.5 py-2"
              >
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-zinc-300">
                    Hard Hit Ceiling (Bottom of Pad)
                  </span>
                  <span className="font-mono-tabular font-bold text-red-400">
                    VEL {config.maxVelocity}
                  </span>
                </div>
                <input
                  type="range"
                  min={Math.min(120, config.minVelocity + 10)}
                  max={127}
                  value={config.maxVelocity}
                  onChange={(e) =>
                    onChangeConfig({ ...config, maxVelocity: Number(e.target.value) })
                  }
                  className="w-full accent-red-600 cursor-pointer"
                />
              </div>

              {/* Exponential Slope Factor (Only active in Exponential mode) */}
              {config.curve === 'exponential' && (
                <div
                  data-hw-title="EXPONENTIAL CURVE SLOPE"
                  data-hw-func="Controls how steeply the exponential velocity curve bends. Higher values widen the soft ghost-note zone."
                  data-hw-state={`SLOPE: ${config.expExponent.toFixed(1)}x`}
                  className="bg-[#15171d] border border-red-500/30 rounded-lg px-2.5 py-2"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-red-200">Exponential Curve Steepness</span>
                    <span className="font-mono-tabular font-bold text-red-400">
                      {config.expExponent.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.4}
                    max={3.5}
                    step={0.1}
                    value={config.expExponent}
                    onChange={(e) =>
                      onChangeConfig({ ...config, expExponent: Number(e.target.value) })
                    }
                    className="w-full accent-red-600 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}

          {/* Last Pad Strike Telemetry & Hardware Full Level Indicator */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 text-[10.5px] font-mono-tabular">
            <div className="truncate text-zinc-400">
              {lastHit ? (
                <span>
                  LAST:{' '}
                  <strong className="text-zinc-200">
                    PAD {lastHit.padIndex + 1} ({lastHit.padName})
                  </strong>{' '}
                  → <strong className="text-red-400">VEL {lastHit.outputVelocity}</strong>
                </span>
              ) : (
                <span>Strike any MPC pad (top = soft, bottom = hard)</span>
              )}
            </div>

            {fullLevel && (
              <button
                type="button"
                onClick={onToggleFullLevel}
                className="px-2 py-0.5 rounded bg-red-600/25 border border-red-500/60 text-red-300 hover:bg-red-600/40 text-[9.5px] font-bold shrink-0 cursor-pointer"
              >
                Full Level ON (Click to Disable)
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
