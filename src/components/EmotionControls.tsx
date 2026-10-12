import React from 'react';
import { RotateCcw, Sliders, Smile, Sparkles } from 'lucide-react';
import { EmotionParameters, EmotionPresetKey, EMOTION_PRESETS } from '../types/emotion';

interface EmotionControlsProps {
  currentPreset: EmotionPresetKey;
  onSelectPreset: (key: EmotionPresetKey) => void;
  emotionParams: EmotionParameters;
  onChangeParams: (params: EmotionParameters) => void;
  onResetParams: () => void;
}

export const EmotionControls: React.FC<EmotionControlsProps> = ({
  currentPreset,
  onSelectPreset,
  emotionParams,
  onChangeParams,
  onResetParams,
}) => {
  const updateParam = (key: keyof EmotionParameters, value: number) => {
    onChangeParams({
      ...emotionParams,
      [key]: value,
    });
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-6">
      {/* Header with Title and Reset */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Customizable Emotions
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time facial geometry & expression blend weights
          </p>
        </div>

        <button
          onClick={onResetParams}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
          title="Reset to selected preset defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Preset Selector Grid */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-neutral-400">Emotion Presets</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(EMOTION_PRESETS) as EmotionPresetKey[]).map((key) => {
            const preset = EMOTION_PRESETS[key];
            const isSelected = currentPreset === key;
            return (
              <button
                key={key}
                onClick={() => onSelectPreset(key)}
                className={`p-2.5 text-left rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-800 border-neutral-600 text-white shadow-sm'
                    : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                }`}
              >
                <div className="text-xs font-medium truncate">{preset.label}</div>
                <div className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fine-Tuning Sliders */}
      <div className="space-y-4 pt-2 border-t border-neutral-800/80">
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
          <Sliders className="w-3.5 h-3.5 text-neutral-400" />
          <span>Micro-Expression Calibration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Smile / Valence */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-neutral-300">
              <span>Smile / Valence</span>
              <span className="font-mono tabular-nums text-neutral-400">
                {(emotionParams.smileValence * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="-1.0"
              max="1.0"
              step="0.05"
              value={emotionParams.smileValence}
              onChange={(e) => updateParam('smileValence', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500">
              <span>Somber (-100%)</span>
              <span>Radiant (+100%)</span>
            </div>
          </div>

          {/* Eyebrow Tension / Arch */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-neutral-300">
              <span>Eyebrow Tension</span>
              <span className="font-mono tabular-nums text-neutral-400">
                {(emotionParams.browRaise * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="-1.0"
              max="1.0"
              step="0.05"
              value={emotionParams.browRaise}
              onChange={(e) => updateParam('browRaise', parseFloat(e.target.value))}
              className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500">
              <span>Furrowed</span>
              <span>Raised</span>
            </div>
          </div>

          {/* Eye Squint / Openness */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-neutral-300">
              <div className="flex items-center gap-1.5">
                <span>Eye Squint (Duchenne Smile)</span>
                {emotionParams.eyeSquint === 0.0 && (
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                    Default (Natural)
                  </span>
                )}
              </div>
              <span className="font-mono tabular-nums text-neutral-400">
                {(emotionParams.eyeSquint * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-neutral-500 leading-tight">
              Photographic eyelid and eyebrow skin color match seamlessly. Narrows palpebral slit naturally during smiling without any artificial patches.
            </p>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={emotionParams.eyeSquint}
              onChange={(e) => updateParam('eyeSquint', parseFloat(e.target.value))}
              className="w-full accent-amber-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono tabular-nums">
              <span className={emotionParams.eyeSquint === 0.0 ? 'text-emerald-400 font-semibold' : ''}>0% (Natural Open)</span>
              <span>25% (Subtle)</span>
              <span>50% (Smiling)</span>
              <span>100% (Squint)</span>
            </div>
          </div>

          {/* Articulation Multiplier / Calibrated Exaggeration */}
          <div className="space-y-1.5 group relative">
            <div className="flex items-center justify-between text-neutral-300">
              <div className="flex items-center gap-1.5">
                <span>Lip Articulation Exaggeration</span>
                <div
                  className="cursor-help text-neutral-500 hover:text-neutral-300 transition-colors"
                  title="Adjusts the visibility of mouth articulation while preserving natural facial proportions. Higher values should improve clarity without creating exaggerated mouth shapes."
                >
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 text-[10px] rounded-full border border-neutral-600 bg-neutral-800 text-neutral-300">
                    i
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {emotionParams.articulationScale === 0.85 && (
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                    Default
                  </span>
                )}
                <span className="font-mono tabular-nums text-neutral-300 font-medium">
                  {(emotionParams.articulationScale * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Tooltip Description Callout */}
            <p className="text-[10px] text-neutral-500 leading-tight">
              Adjusts the visibility of mouth articulation while preserving natural facial proportions. Higher values should improve clarity without creating exaggerated mouth shapes.
            </p>

            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={emotionParams.articulationScale}
              onChange={(e) => updateParam('articulationScale', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono tabular-nums">
              <span className={emotionParams.articulationScale === 0.50 ? 'text-neutral-300 font-semibold' : ''}>50% (Subtle)</span>
              <span className={emotionParams.articulationScale === 0.75 ? 'text-neutral-300 font-semibold' : ''}>75% (Conv.)</span>
              <span className={emotionParams.articulationScale === 0.85 ? 'text-emerald-400 font-semibold' : 'text-emerald-500/80'}>85% (Rec.)</span>
              <span className={emotionParams.articulationScale === 1.00 ? 'text-neutral-300 font-semibold' : ''}>100% (Clear)</span>
              <span className={emotionParams.articulationScale >= 1.20 ? 'text-neutral-300 font-semibold' : ''}>120%+ (Exp.)</span>
            </div>
          </div>

          {/* Head Tilt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-neutral-300">
              <div className="flex items-center gap-1.5">
                <span>Portrait Studio Framing</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono">
                  Stationary Locked
                </span>
              </div>
              <span className="font-mono tabular-nums text-neutral-400">
                {(emotionParams.headTilt * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-neutral-500 leading-tight">
              The image background remains rock-solid and stationary. No unwanted background swaying or tilt while speaking.
            </p>
            <input
              type="range"
              min="-1.0"
              max="1.0"
              step="0.1"
              value={emotionParams.headTilt}
              onChange={(e) => updateParam('headTilt', parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono tabular-nums">
              <span>Left Poise</span>
              <span className={emotionParams.headTilt === 0.0 ? 'text-emerald-400 font-semibold' : ''}>0% (Centered)</span>
              <span>Right Poise</span>
            </div>
          </div>

          {/* Micro-Movement & Biological Breathing */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-neutral-300">
              <div className="flex items-center gap-1.5">
                <span>Facial Micro-Expressions</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono">
                  Background Locked
                </span>
              </div>
              <span className="font-mono tabular-nums text-neutral-400">
                {(emotionParams.microMovement * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-[10px] text-neutral-500 leading-tight">
              Image background remains completely stationary and still while speaking. Only natural mouth articulation and facial features animate.
            </p>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.1"
              value={emotionParams.microMovement}
              onChange={(e) => updateParam('microMovement', parseFloat(e.target.value))}
              className="w-full accent-teal-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono tabular-nums">
              <span className={emotionParams.microMovement === 0.0 ? 'text-emerald-400 font-semibold' : ''}>0% (Stationary)</span>
              <span>Subtle</span>
              <span>Expressive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
