export type EmotionPresetKey =
  | 'Neutral'
  | 'Joyful'
  | 'Serious'
  | 'Empathetic'
  | 'Dramatic'
  | 'Thoughtful'
  | 'Skeptical'
  | 'Melancholy';

export interface EmotionParameters {
  smileValence: number;     // -1.0 (frown) to +1.0 (radiant smile)
  browRaise: number;        // -1.0 (furrowed/stern) to +1.0 (raised/surprised)
  eyeSquint: number;        // 0.0 (wide) to 1.0 (squinted / laughing)
  headTilt: number;         // -1.0 to 1.0 (degree of subtle emotional tilt)
  nodAmplitude: number;     // 0.0 to 2.0 (speech cadence nod responsiveness)
  articulationScale: number;// 0.5 to 2.0 (lip motion exaggeration)
  microMovement: number;    // 0.0 to 2.0 (idle breathing & biological sway)
  blinkRate: number;        // 0.5 to 2.0 (blink frequency multiplier)
}

export interface EmotionPreset {
  key: EmotionPresetKey;
  label: string;
  description: string;
  params: EmotionParameters;
  promptDescription: string;
}

export const DEFAULT_CALIBRATION_PARAMS: EmotionParameters = {
  smileValence: 0.15,      // 15% Subtle pleasant baseline
  browRaise: 0.0,          // 0% Natural neutral brow
  eyeSquint: 0.0,          // 0% Pristine open eyes at rest (zero patch)
  headTilt: 0.0,           // 0% Stationary background (zero rotation)
  nodAmplitude: 0.0,       // 0% Stationary background (zero speaking bob)
  articulationScale: 0.85, // 85% Recommended Default
  microMovement: 0.0,      // 0% Stationary background (zero camera drift)
  blinkRate: 1.0,          // 1.0 Normal biological blink rate
};

export const EMOTION_PRESETS: Record<EmotionPresetKey, EmotionPreset> = {
  Neutral: {
    key: 'Neutral',
    label: 'Natural Baseline',
    description: 'Stationary framing, wide-open natural eyes, crisp lip-sync',
    params: {
      ...DEFAULT_CALIBRATION_PARAMS,
    },
    promptDescription: 'Natural, poised, clear conversational delivery',
  },
  Joyful: {
    key: 'Joyful',
    label: 'Joyful & Warm',
    description: 'Warm smile, elevated cheekbones, natural friendly articulation',
    params: {
      smileValence: 0.35,
      browRaise: 0.10,
      eyeSquint: 0.18,
      headTilt: 0.0,
      nodAmplitude: 0.0,
      articulationScale: 0.85,
      microMovement: 0.0,
      blinkRate: 1.1,
    },
    promptDescription: 'Warm, friendly, joyful presentation with natural pacing',
  },
  Serious: {
    key: 'Serious',
    label: 'Serious / Authoritative',
    description: 'Firm brow tension, steady eye gaze, disciplined lip motion',
    params: {
      smileValence: -0.15,
      browRaise: -0.15,
      eyeSquint: 0.0,
      headTilt: 0.0,
      nodAmplitude: 0.0,
      articulationScale: 0.85,
      microMovement: 0.0,
      blinkRate: 0.85,
    },
    promptDescription: 'Authoritative, serious, disciplined executive speech',
  },
  Empathetic: {
    key: 'Empathetic',
    label: 'Empathetic & Caring',
    description: 'Gently raised inner brows, receptive presence, soft smile',
    params: {
      smileValence: 0.20,
      browRaise: 0.15,
      eyeSquint: 0.05,
      headTilt: 0.0,
      nodAmplitude: 0.0,
      articulationScale: 0.85,
      microMovement: 0.0,
      blinkRate: 1.05,
    },
    promptDescription: 'Deeply empathetic, understanding, warm conversational tone',
  },
  Dramatic: {
    key: 'Dramatic',
    label: 'Dramatic & Expressive',
    description: 'Clear articulate projection within natural anatomical limits',
    params: {
      smileValence: 0.25,
      browRaise: 0.25,
      eyeSquint: 0.05,
      headTilt: 0.0,
      nodAmplitude: 0.0,
      articulationScale: 0.95,
      microMovement: 0.0,
      blinkRate: 1.15,
    },
    promptDescription: 'Engaging, expressive keynote announcement with clear diction',
  },
  Thoughtful: {
    key: 'Thoughtful',
    label: 'Thoughtful / Reflective',
    description: 'Contemplative brow curve, gentle expression, measured cadence',
    params: {
      smileValence: 0.05,
      browRaise: 0.10,
      eyeSquint: 0.05,
      headTilt: 0.0,
      nodAmplitude: 0.0,
      articulationScale: 0.80,
      microMovement: 0.0,
      blinkRate: 0.90,
    },
    promptDescription: 'Thoughtful, reflective, articulate analytical commentary',
  },
  Skeptical: {
    key: 'Skeptical',
    label: 'Skeptical / Inquisitive',
    description: 'Asymmetric single brow arch, focused eye aperture',
    params: {
      smileValence: -0.05,
      browRaise: 0.20,
      eyeSquint: 0.10,
      headTilt: 0.0,
      nodAmplitude: 0.0,
      articulationScale: 0.85,
      microMovement: 0.0,
      blinkRate: 0.95,
    },
    promptDescription: 'Inquisitive, curious, mildly skeptical questioning tone',
  },
  Melancholy: {
    key: 'Melancholy',
    label: 'Melancholy / Somber',
    description: 'Turned-down lip edges, soft downward eye gaze, gentle cadence',
    params: {
      smileValence: -0.25,
      browRaise: 0.10,
      eyeSquint: 0.0,
      headTilt: 0.0,
      nodAmplitude: 0.0,
      articulationScale: 0.78,
      microMovement: 0.0,
      blinkRate: 0.80,
    },
    promptDescription: 'Somber, gentle, heartfelt reflective emotional tone',
  },
};
