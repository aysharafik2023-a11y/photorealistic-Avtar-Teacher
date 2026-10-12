export interface FaceLandmarks {
  mouthCenter: { x: number; y: number }; // normalized 0 - 1
  mouthLeft: { x: number; y: number };
  mouthRight: { x: number; y: number };
  upperLipMid: { x: number; y: number };
  lowerLipMid: { x: number; y: number };
  chin: { x: number; y: number };
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  leftBrow: { x: number; y: number };
  rightBrow: { x: number; y: number };
  noseTip: { x: number; y: number };
  leftCheek: { x: number; y: number };
  rightCheek: { x: number; y: number };
}

export interface AvatarProfile {
  id: string;
  name: string;
  role: string;
  tagline: string;
  imageSrc: string;
  gender: 'female' | 'male';
  defaultVoice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  defaultEmotion: string;
  landmarks: FaceLandmarks;
  skinHue: string; // for oral cavity & ambient occlusion tinting
  lipVermilionColor: string; // sampled lip tone
}

export interface VisemeState {
  jawOpen: number;         // 0 (closed) to 1 (wide open, anatomically bounded)
  mouthSpread: number;     // -1 (pucker/round) to +1 (wide smile/stretch)
  lipPucker: number;       // 0 to 1 (/oo/, /w/)
  lipPress: number;        // 0 to 1 (/m/, /b/, /p/ bilabial seal)
  teethExposure: number;   // 0 to 1 (visible teeth incisal edge)
  tongueRaise: number;     // 0 to 1 (/l/, /th/, /d/ lingual elevation)
  lowerLipTuck: number;    // 0 to 1 (/f/, /v/ labiodental tuck)
  audioEnergy: number;     // instantaneous RMS decibel / volume
  phonemeCategory?: 'silence' | 'bilabial' | 'labiodental' | 'rounded' | 'open_vowel' | 'wide_vowel' | 'alveolar';
  activePhonemeLabel?: string;
  apertureMm?: number;     // estimated anatomical opening in millimeters (nominal 0 - 12mm)
}
