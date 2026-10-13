import { VisemeState } from '../types/avatar';

export class AudioVisemeAnalyzer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | AudioBufferSourceNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private isRunning: boolean = false;

  // Synthetic speech viseme driver for browser speech synthesis & offline/static hosting
  private isSyntheticSpeechActive: boolean = false;
  private syntheticText: string = '';
  private syntheticTime: number = 0;
  private currentPhonemeBias: VisemeState['phonemeCategory'] | null = null;
  private currentPhonemeTimer: number = 0;
  private lastVisemeComputeTime: number = 0;

  // Smoothed internal values for lifelike physics
  private smoothedJaw: number = 0;
  private smoothedSpread: number = 0;
  private smoothedPucker: number = 0;
  private smoothedTeeth: number = 0;
  private smoothedLipPress: number = 0;
  private smoothedTongue: number = 0;
  private smoothedTuck: number = 0;
  private smoothedEnergy: number = 0;

  // Dynamic sensitivity multiplier
  public sensitivity: number = 1.2;
  public noiseFloor: number = 0.015;

  constructor() {}

  public getContext(): AudioContext | null {
    return this.audioCtx;
  }

  public async resumeContext(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {}
    }
  }

  private initContextIfNeeded() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    if (!this.analyser) {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.25;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);
    }
  }

  /**
   * Connect to a live microphone stream
   */
  public async connectMicrophone(stream: MediaStream): Promise<void> {
    this.initContextIfNeeded();
    if (!this.audioCtx || !this.analyser) return;

    this.disconnect();
    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
    this.sourceNode.connect(this.analyser);
    // Don't connect mic to destination to prevent feedback loop!
    this.isRunning = true;
  }

  /**
   * Connect to an HTML audio element (for TTS or uploaded audio file playback)
   */
  public connectAudioElement(audioElement: HTMLAudioElement): void {
    this.initContextIfNeeded();
    if (!this.audioCtx || !this.analyser) return;

    this.disconnect();
    try {
      this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    } catch {
      // If already connected to media element, continue
    }
    this.isRunning = true;
  }

  /**
   * Play an ArrayBuffer or decoded AudioBuffer
   */
  public playAudioBuffer(buffer: AudioBuffer, onEnded?: () => void): AudioBufferSourceNode | null {
    this.initContextIfNeeded();
    if (!this.audioCtx || !this.analyser) return null;

    this.disconnect();
    const bufferSource = this.audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);

    if (onEnded) {
      bufferSource.onended = () => {
        onEnded();
      };
    }

    bufferSource.start(0);
    this.sourceNode = bufferSource;
    this.isRunning = true;
    return bufferSource;
  }

  public disconnect(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    this.isSyntheticSpeechActive = false;
    this.isRunning = false;
    this.resetVisemes();
  }

  public resetVisemes(): void {
    this.smoothedJaw = 0;
    this.smoothedSpread = 0;
    this.smoothedPucker = 0;
    this.smoothedTeeth = 0;
    this.smoothedLipPress = 0;
    this.smoothedTongue = 0;
    this.smoothedTuck = 0;
    this.smoothedEnergy = 0;
    this.currentPhonemeBias = null;
    this.currentPhonemeTimer = 0;
  }

  /**
   * Activates biological phonetic articulatory driver for browser speech synthesis & offline/static hosting
   */
  public startSyntheticSpeech(text?: string): void {
    this.isRunning = true;
    this.isSyntheticSpeechActive = true;
    this.syntheticText = text || '';
    this.syntheticTime = 0;
    this.currentPhonemeBias = null;
    this.currentPhonemeTimer = 0;
    this.lastVisemeComputeTime = performance.now() / 1000;
  }

  public stopSyntheticSpeech(): void {
    this.isSyntheticSpeechActive = false;
    this.isRunning = false;
    this.resetVisemes();
  }

  public updateSpeechWord(word: string): void {
    if (!word) return;
    const lower = word.toLowerCase().trim();
    if (/^[pmb]/.test(lower) || /[pmb]$/.test(lower)) {
      this.currentPhonemeBias = 'bilabial';
      this.currentPhonemeTimer = 0.12;
    } else if (/[fv]/.test(lower)) {
      this.currentPhonemeBias = 'labiodental';
      this.currentPhonemeTimer = 0.15;
    } else if (/(oo|ou|ow|u|o)/.test(lower)) {
      this.currentPhonemeBias = 'rounded';
      this.currentPhonemeTimer = 0.20;
    } else if (/(ee|ea|ey|i|ae)/.test(lower)) {
      this.currentPhonemeBias = 'wide_vowel';
      this.currentPhonemeTimer = 0.20;
    } else if (/(th|t|d|n|l|s)/.test(lower)) {
      this.currentPhonemeBias = 'alveolar';
      this.currentPhonemeTimer = 0.18;
    } else {
      this.currentPhonemeBias = 'open_vowel';
      this.currentPhonemeTimer = 0.22;
    }
  }

  /**
   * Called every animation frame (60 FPS) to compute the current phonetic visemes
   */
  public getCurrentVisemes(articulationScale: number = 1.0): VisemeState {
    const now = performance.now() / 1000;
    const dt = this.lastVisemeComputeTime > 0 ? Math.max(0.005, Math.min(0.06, now - this.lastVisemeComputeTime)) : 0.016;
    this.lastVisemeComputeTime = now;

    // Handle synthetic speech synthesis driver (e.g. browser Web Speech API / static hosting)
    if (this.isSyntheticSpeechActive) {
      this.syntheticTime += dt;
      if (this.currentPhonemeTimer > 0) {
        this.currentPhonemeTimer -= dt;
      }

      // Natural speech rhythm: ~3.8 syllables per second
      const syllRate = 3.8;
      const cycle = this.syntheticTime * syllRate;
      const cycleFraction = cycle % 1.0;
      const openCurve = Math.sin(cycleFraction * Math.PI);
      const stress = 0.70 + 0.30 * Math.sin(cycle * 0.45);

      const syllIdx = Math.floor(cycle);
      const pattern = syllIdx % 5;

      let targetJaw = 0;
      let targetSpread = 0;
      let targetPucker = 0;
      let targetTeeth = 0;
      let targetLipPress = 0;
      let targetTongue = 0;
      let targetTuck = 0;
      let phonemeCategory: VisemeState['phonemeCategory'] = 'open_vowel';
      let activePhonemeLabel = 'Vowel';

      const bias = this.currentPhonemeTimer > 0 ? this.currentPhonemeBias : null;

      if (bias === 'bilabial' || (pattern === 0 && cycleFraction < 0.26)) {
        targetLipPress = 0.90;
        targetJaw = 0.0;
        phonemeCategory = 'bilabial';
        activePhonemeLabel = 'Bilabial /p, b, m/';
      } else if (bias === 'labiodental' || (pattern === 3 && cycleFraction < 0.28)) {
        targetTuck = 0.50;
        targetJaw = 0.16;
        targetTeeth = 0.35;
        phonemeCategory = 'labiodental';
        activePhonemeLabel = 'Labiodental /f, v/';
      } else if (bias === 'rounded' || pattern === 2) {
        targetPucker = 0.65 * openCurve;
        targetJaw = (0.35 + 0.25 * stress) * openCurve;
        targetSpread = -0.35;
        phonemeCategory = 'rounded';
        activePhonemeLabel = 'Rounded /u, o/';
      } else if (bias === 'wide_vowel' || pattern === 4) {
        targetSpread = 0.50 * openCurve;
        targetTeeth = 0.40 * openCurve;
        targetJaw = (0.30 + 0.20 * stress) * openCurve;
        phonemeCategory = 'wide_vowel';
        activePhonemeLabel = 'Front Vowel /i, e/';
      } else if (bias === 'alveolar') {
        targetTongue = 0.60 * openCurve;
        targetJaw = 0.25 * openCurve;
        targetTeeth = 0.30;
        phonemeCategory = 'alveolar';
        activePhonemeLabel = 'Alveolar /t, d, n/';
      } else {
        targetJaw = (0.50 + 0.30 * stress) * openCurve;
        targetSpread = 0.05;
        targetTeeth = 0.25 * openCurve;
        phonemeCategory = 'open_vowel';
        activePhonemeLabel = 'Open Vowel /a, ɑ/';
      }

      // Smooth kinematics
      const attack = targetLipPress > 0.5 ? 0.75 : 0.50;
      const decay = 0.35;
      const maxVelocity = 0.14;

      const rawDeltaJaw = (targetJaw - this.smoothedJaw) * (targetJaw > this.smoothedJaw ? attack : decay);
      const clampedDeltaJaw = Math.max(-maxVelocity, Math.min(maxVelocity, rawDeltaJaw));
      this.smoothedJaw += clampedDeltaJaw;

      this.smoothedSpread += (targetSpread - this.smoothedSpread) * 0.35;
      this.smoothedPucker += (targetPucker - this.smoothedPucker) * 0.35;
      this.smoothedTeeth += (targetTeeth - this.smoothedTeeth) * 0.40;
      this.smoothedLipPress += (targetLipPress - this.smoothedLipPress) * 0.60;
      this.smoothedTongue += (targetTongue - this.smoothedTongue) * 0.35;
      this.smoothedTuck += (targetTuck - this.smoothedTuck) * 0.35;
      this.smoothedEnergy = Math.max(0.15, this.smoothedJaw * 0.7);

      if (this.smoothedLipPress > 0.35) {
        this.smoothedJaw = Math.max(0, this.smoothedJaw * (1.0 - this.smoothedLipPress));
      }

      if (this.smoothedJaw < 0.01) this.smoothedJaw = 0;

      const apertureMm = Math.round(this.smoothedJaw * 10 * 10) / 10;

      return {
        jawOpen: Math.max(0, Math.min(1, this.smoothedJaw)),
        mouthSpread: Math.max(-1, Math.min(1, this.smoothedSpread)),
        lipPucker: Math.max(0, Math.min(1, this.smoothedPucker)),
        lipPress: Math.max(0, Math.min(1, this.smoothedLipPress)),
        teethExposure: Math.max(0, Math.min(1, this.smoothedTeeth)),
        tongueRaise: Math.max(0, Math.min(1, this.smoothedTongue)),
        lowerLipTuck: Math.max(0, Math.min(1, this.smoothedTuck)),
        audioEnergy: Math.max(0, Math.min(1, this.smoothedEnergy)),
        phonemeCategory,
        activePhonemeLabel,
        apertureMm,
      };
    }

    if (!this.analyser || !this.freqData || !this.timeData || !this.isRunning) {
      // Natural decay to resting pose
      this.smoothedJaw *= 0.85;
      this.smoothedSpread *= 0.85;
      this.smoothedPucker *= 0.85;
      this.smoothedTeeth *= 0.85;
      this.smoothedLipPress *= 0.85;
      this.smoothedTongue *= 0.85;
      this.smoothedTuck *= 0.85;
      this.smoothedEnergy *= 0.85;

      return {
        jawOpen: this.smoothedJaw,
        mouthSpread: this.smoothedSpread,
        lipPucker: this.smoothedPucker,
        lipPress: this.smoothedLipPress,
        teethExposure: this.smoothedTeeth,
        tongueRaise: this.smoothedTongue,
        lowerLipTuck: this.smoothedTuck,
        audioEnergy: this.smoothedEnergy,
      };
    }

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    const binCount = this.analyser.frequencyBinCount;
    const nyquist = (this.audioCtx?.sampleRate || 48000) / 2;
    const binHz = nyquist / binCount;

    // 1. RMS Energy
    let sumSquares = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const norm = (this.timeData[i] - 128) / 128;
      sumSquares += norm * norm;
    }
    const rawRms = Math.sqrt(sumSquares / this.timeData.length);
    const activeRms = Math.max(0, rawRms - this.noiseFloor) * this.sensitivity;

    // 2. Frequency bands
    const getBandEnergy = (startHz: number, endHz: number) => {
      const startBin = Math.max(0, Math.floor(startHz / binHz));
      const endBin = Math.min(binCount - 1, Math.ceil(endHz / binHz));
      if (endBin <= startBin) return 0;

      let sum = 0;
      for (let i = startBin; i <= endBin; i++) {
        sum += this.freqData![i];
      }
      return sum / ((endBin - startBin + 1) * 255);
    };

    const lowEnergy = getBandEnergy(120, 600);    // F1 / open vowel / vocal cord fundamental
    const midEnergy = getBandEnergy(700, 2200);   // F2 / front-back vowel resonance
    const highEnergy = getBandEnergy(2500, 6500); // Fricatives, sibilants, crisp consonants

    // 3. Phonetic Formant / Viseme Derivation
    let targetJaw = 0;
    let targetSpread = 0;
    let targetPucker = 0;
    let targetTeeth = 0;
    let targetLipPress = 0;
    let targetTongue = 0;
    let targetTuck = 0;
    let phonemeCategory: VisemeState['phonemeCategory'] = 'silence';
    let activePhonemeLabel = 'Resting Silence';

    if (activeRms > 0.022) {
      // Bilabial check: /m/, /b/, /p/
      // Characterized by low-frequency nasal murmur or pre-burst closure
      const isBilabial = (activeRms > 0.035 && lowEnergy > 0.22 && midEnergy < 0.11 && highEnergy < 0.07);

      if (isBilabial) {
        phonemeCategory = 'bilabial';
        activePhonemeLabel = 'Bilabial /p, b, m/';
        targetLipPress = 0.95;
        targetJaw = 0.0;     // Full anatomical seal
        targetTeeth = 0.0;
        targetSpread = 0.0;
      } else if (highEnergy > 0.32 && lowEnergy < 0.20) {
        // Labiodental check: /f/, /v/
        // High frequency dental frication with lower vowel energy
        phonemeCategory = 'labiodental';
        activePhonemeLabel = 'Labiodental /f, v/';
        targetTuck = Math.min(0.70, (highEnergy - 0.15) * 1.8);
        targetJaw = 0.15;    // Minimal aperture for airflow
        targetTeeth = 0.35;  // Upper incisal edge meets lower lip
        targetSpread = 0.10;
      } else if (lowEnergy > midEnergy * 1.35 && highEnergy < 0.14) {
        // Rounded back vowel: /u/, /o/, /w/, /oo/
        phonemeCategory = 'rounded';
        activePhonemeLabel = 'Rounded Vowel /u, o, w/';
        targetPucker = Math.min(0.85, (lowEnergy - midEnergy) * 2.2);
        targetJaw = Math.min(0.55, (lowEnergy * 0.9 + activeRms * 0.4));
        targetSpread = -0.50; // Constrained width
      } else if (midEnergy > 0.28 && highEnergy > 0.15 && lowEnergy < midEnergy) {
        // Wide front vowel: /ee/, /ih/, /ae/
        phonemeCategory = 'wide_vowel';
        activePhonemeLabel = 'Wide Front Vowel /i, e, æ/';
        targetSpread = Math.min(0.65, (midEnergy - lowEnergy * 0.5) * 1.5);
        targetJaw = Math.min(0.48, activeRms * 0.9 + lowEnergy * 0.4);
        targetTeeth = Math.min(0.50, midEnergy * 1.2);
      } else if (midEnergy > 0.25 && targetJaw > 0.20 && highEnergy > 0.12) {
        // Alveolar / Lingual: /t/, /d/, /n/, /l/
        phonemeCategory = 'alveolar';
        activePhonemeLabel = 'Alveolar Lingual /t, d, n, l/';
        targetTongue = Math.min(0.75, midEnergy * 1.4);
        targetJaw = 0.30;
        targetTeeth = 0.30;
      } else {
        // Open Vowels: /a/, /ɑ/, /aw/
        phonemeCategory = 'open_vowel';
        activePhonemeLabel = 'Open Vowel /a, ɑ, ʌ/';
        const vowelStrength = Math.min(1.0, (lowEnergy * 1.3 + midEnergy * 0.7) * 1.1);
        targetJaw = Math.min(0.80, vowelStrength * 0.65 + activeRms * 0.45);
        targetSpread = 0.05;
        targetTeeth = Math.min(0.45, activeRms * 0.8);
      }
    } else {
      // Natural silence threshold
      targetJaw = 0;
      targetSpread = 0;
      targetPucker = 0;
      targetTeeth = 0;
      targetLipPress = 0;
      targetTongue = 0;
      targetTuck = 0;
      phonemeCategory = 'silence';
      activePhonemeLabel = 'Resting Silence';
    }

    // 4. Low-latency biological smoothing with rate-of-change limit
    const attack = targetLipPress > 0.5 ? 0.75 : 0.50; // Fast onset on consonant closure
    const decay = activeRms <= 0.022 ? 0.38 : 0.28;

    // Rate-of-change cap (velocity limit) to prevent abrupt jumps
    const maxVelocity = 0.12; // Maximum delta per frame (~60 FPS)

    const rawDeltaJaw = (targetJaw - this.smoothedJaw) * (targetJaw > this.smoothedJaw ? attack : decay);
    const clampedDeltaJaw = Math.max(-maxVelocity, Math.min(maxVelocity, rawDeltaJaw));
    this.smoothedJaw += clampedDeltaJaw;

    this.smoothedSpread += (targetSpread - this.smoothedSpread) * 0.30;
    this.smoothedPucker += (targetPucker - this.smoothedPucker) * 0.30;
    this.smoothedTeeth += (targetTeeth - this.smoothedTeeth) * (targetTeeth > this.smoothedTeeth ? 0.55 : 0.25);
    this.smoothedLipPress += (targetLipPress - this.smoothedLipPress) * (targetLipPress > this.smoothedLipPress ? 0.75 : 0.35);
    this.smoothedTongue += (targetTongue - this.smoothedTongue) * 0.35;
    this.smoothedTuck += (targetTuck - this.smoothedTuck) * 0.35;
    this.smoothedEnergy += (activeRms - this.smoothedEnergy) * 0.40;

    // If bilabial seal is engaged, force jaw opening to zero
    if (this.smoothedLipPress > 0.35) {
      this.smoothedJaw = Math.max(0, this.smoothedJaw * (1.0 - this.smoothedLipPress));
    }

    // Zero out sub-threshold flutter for crisp resting mouth
    if (this.smoothedJaw < 0.012) this.smoothedJaw = 0;
    if (this.smoothedEnergy < 0.008) this.smoothedEnergy = 0;

    const apertureMm = Math.round(this.smoothedJaw * 10 * 10) / 10;

    return {
      jawOpen: Math.max(0, Math.min(1, this.smoothedJaw)),
      mouthSpread: Math.max(-1, Math.min(1, this.smoothedSpread)),
      lipPucker: Math.max(0, Math.min(1, this.smoothedPucker)),
      lipPress: Math.max(0, Math.min(1, this.smoothedLipPress)),
      teethExposure: Math.max(0, Math.min(1, this.smoothedTeeth)),
      tongueRaise: Math.max(0, Math.min(1, this.smoothedTongue)),
      lowerLipTuck: Math.max(0, Math.min(1, this.smoothedTuck)),
      audioEnergy: Math.max(0, Math.min(1, this.smoothedEnergy)),
      phonemeCategory,
      activePhonemeLabel,
      apertureMm,
    };
  }
}
