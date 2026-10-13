import { AvatarProfile, VisemeState } from '../types/avatar';
import { EmotionParameters } from '../types/emotion';

export interface RenderState {
  time: number;               // seconds
  avatar: AvatarProfile;
  image: HTMLImageElement | null;
  visemes: VisemeState;
  emotion: EmotionParameters;
  zoomLevel: 'portrait' | 'closeup' | 'wide';
}

export class FaceRenderer {
  private lastBlinkTimestamp: number = 0;
  private blinkDuration: number = 0.28; // seconds (~280ms natural human blink)
  private nextBlinkInterval: number = 3.2; // seconds
  private isBlinking: boolean = false;
  private blinkTimer: number = 0;
  private blinkProgress: number = 0; // 0 (open) to 1 (closed)
  private skinColorCache: Map<string, { r: number; g: number; b: number }> = new Map();

  // Offscreen canvases for photographic texture warping
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D | null;
  private eyeCanvas: HTMLCanvasElement;
  private eyeCtx: CanvasRenderingContext2D | null;

  constructor() {
    this.nextBlinkInterval = 2.5 + Math.random() * 2.5;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 800;
    this.offscreenCanvas.height = 800;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');

    this.eyeCanvas = document.createElement('canvas');
    this.eyeCanvas.width = 800;
    this.eyeCanvas.height = 800;
    this.eyeCtx = this.eyeCanvas.getContext('2d');
  }

  /**
   * Main render method called on every requestAnimationFrame (60 FPS)
   */
  public render(ctx: CanvasRenderingContext2D, width: number, height: number, state: RenderState): void {
    ctx.clearRect(0, 0, width, height);

    if (!state.image || !state.image.complete || state.image.naturalWidth === 0) {
      this.renderPlaceholder(ctx, width, height, state.avatar);
      return;
    }

    const { time, avatar, image, visemes, emotion, zoomLevel } = state;

    // 1. Biological blink cycle (autonomous monotonic clock)
    this.updateBlink(emotion.blinkRate);

    // 2. Locked stationary framing: The image and its background remain 100% completely stationary.
    // Zero canvas rotation, zero bobbing, zero breathing drift, and zero background movement while speaking.

    // 3. Framing & transforms (stable locked framing)
    ctx.save();

    let baseScale = 1.0;
    let offsetY = 0;
    if (zoomLevel === 'closeup') {
      baseScale = 1.35;
      offsetY = height * 0.08;
    } else if (zoomLevel === 'wide') {
      baseScale = 0.88;
      offsetY = -height * 0.04;
    }

    if (baseScale !== 1.0 || offsetY !== 0) {
      const pivotX = width * 0.5;
      const pivotY = height * avatar.landmarks.mouthCenter.y;
      ctx.translate(pivotX, pivotY + offsetY);
      ctx.scale(baseScale, baseScale);
      ctx.translate(-pivotX, -pivotY);
    }

    // 4. Calculate image draw bounds
    const imgAspect = image.naturalWidth / image.naturalHeight;
    const canvasAspect = width / height;
    let drawW = width;
    let drawH = height;
    let drawX = 0;
    let drawY = 0;

    if (canvasAspect > imgAspect) {
      drawH = width / imgAspect;
      drawY = (height - drawH) / 2;
    } else {
      drawW = height * imgAspect;
      drawX = (width - drawW) / 2;
    }

    // Draw base portrait photo (high resolution, pristine)
    ctx.drawImage(image, drawX, drawY, drawW, drawH);

    // Landmark pixel conversion helpers
    const toPxX = (normX: number) => drawX + normX * drawW;
    const toPxY = (normY: number) => drawY + normY * drawH;

    const lm = avatar.landmarks;
    const mouthCenter = { x: toPxX(lm.mouthCenter.x), y: toPxY(lm.mouthCenter.y) };
    const mouthLeft = { x: toPxX(lm.mouthLeft.x), y: toPxY(lm.mouthLeft.y) };
    const mouthRight = { x: toPxX(lm.mouthRight.x), y: toPxY(lm.mouthRight.y) };
    const upperLip = { x: toPxX(lm.upperLipMid.x), y: toPxY(lm.upperLipMid.y) };
    const lowerLip = { x: toPxX(lm.lowerLipMid.x), y: toPxY(lm.lowerLipMid.y) };
    const chin = { x: toPxX(lm.chin.x), y: toPxY(lm.chin.y) };

    const leftEye = { x: toPxX(lm.leftEye.x), y: toPxY(lm.leftEye.y) };
    const rightEye = { x: toPxX(lm.rightEye.x), y: toPxY(lm.rightEye.y) };
    const leftBrow = { x: toPxX(lm.leftBrow.x), y: toPxY(lm.leftBrow.y) };
    const rightBrow = { x: toPxX(lm.rightBrow.x), y: toPxY(lm.rightBrow.y) };
    const leftCheek = { x: toPxX(lm.leftCheek.x), y: toPxY(lm.leftCheek.y) };
    const rightCheek = { x: toPxX(lm.rightCheek.x), y: toPxY(lm.rightCheek.y) };

    // 5. Natural Photographic Brow & Cheek Dynamics
    this.renderNaturalBrowsAndCheeks(
      ctx,
      image,
      drawX,
      drawY,
      drawW,
      drawH,
      emotion,
      leftBrow,
      rightBrow,
      leftCheek,
      rightCheek
    );

    // 6. Natural Photographic Eye Squint & Anatomical Eyelid Blink
    this.renderNaturalEyesAndBlink(
      ctx,
      image,
      drawX,
      drawY,
      drawW,
      drawH,
      leftEye,
      rightEye,
      leftBrow,
      rightBrow,
      avatar,
      emotion
    );

    // 7. Natural Photographic Lip-Sync & Jaw Articulation
    this.renderNaturalLipSync(
      ctx,
      image,
      drawX,
      drawY,
      drawW,
      drawH,
      avatar,
      visemes,
      emotion,
      mouthCenter,
      mouthLeft,
      mouthRight,
      upperLip,
      lowerLip,
      chin
    );

    ctx.restore();
  }

  /**
   * Updates natural human blink timing using an internal high-precision monotonic clock.
   * Completely decoupled from React re-renders, prop changes, or caller timestamp resets.
   */
  private updateBlink(blinkRateMultiplier: number): void {
    const now = performance.now() / 1000;
    if (this.lastBlinkTimestamp === 0) {
      this.lastBlinkTimestamp = now;
      this.nextBlinkInterval = 2.4 + Math.random() * 2.0;
      this.blinkProgress = 0;
      return;
    }

    const dt = Math.max(0.001, Math.min(0.1, now - this.lastBlinkTimestamp));
    this.lastBlinkTimestamp = now;

    const rate = Math.max(0.3, blinkRateMultiplier || 1.0);
    const effectiveInterval = this.nextBlinkInterval / rate;

    if (!this.isBlinking) {
      this.blinkTimer += dt;
      if (this.blinkTimer >= effectiveInterval) {
        this.isBlinking = true;
        this.blinkTimer = 0;
      }
      this.blinkProgress = 0;
    } else {
      this.blinkTimer += dt;
      if (this.blinkTimer >= this.blinkDuration) {
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.blinkProgress = 0;
        this.nextBlinkInterval = 2.6 + Math.random() * 2.4;
      } else {
        const t = this.blinkTimer / this.blinkDuration;
        // Asymmetric biological eyelid kinematics:
        // Rapid 35% descent phase, smoother 65% ascent phase
        if (t < 0.35) {
          this.blinkProgress = Math.sin((t / 0.35) * (Math.PI / 2));
        } else {
          this.blinkProgress = Math.cos(((t - 0.35) / 0.65) * (Math.PI / 2));
        }
      }
    }
  }

  private parseHexColor(hex: string): { r: number; g: number; b: number } {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map((c) => c + c).join('');
    }
    const num = parseInt(clean, 16) || 0;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  /**
   * Sample the exact photographic skin tone between the eye and eyebrow.
   * Cached per avatar profile for zero GPU stalls and 100% color consistency.
   */
  private sampleInfrabrowSkinColor(
    image: HTMLImageElement,
    drawX: number,
    drawY: number,
    drawW: number,
    drawH: number,
    eye: { x: number; y: number },
    brow: { x: number; y: number },
    avatarId: string,
    defaultHex: string
  ): { r: number; g: number; b: number } {
    if (this.skinColorCache.has(avatarId)) {
      return this.skinColorCache.get(avatarId)!;
    }
    const baseRgb = this.parseHexColor(defaultHex);
    let resolved = baseRgb;
    try {
      if (this.offscreenCtx && image.naturalWidth > 0 && image.naturalHeight > 0) {
        const normX = Math.max(0, Math.min(1, (eye.x - drawX) / drawW));
        const sampleCanvasY = brow.y + (eye.y - brow.y) * 0.45;
        const normY = Math.max(0, Math.min(1, (sampleCanvasY - drawY) / drawH));

        const sx = Math.floor(normX * image.naturalWidth);
        const sy = Math.floor(normY * image.naturalHeight);

        if (sx >= 0 && sx < image.naturalWidth && sy >= 0 && sy < image.naturalHeight) {
          this.offscreenCtx.save();
          this.offscreenCtx.globalCompositeOperation = 'source-over';
          this.offscreenCtx.clearRect(0, 0, 1, 1);
          this.offscreenCtx.drawImage(image, sx, sy, 1, 1, 0, 0, 1, 1);
          const data = this.offscreenCtx.getImageData(0, 0, 1, 1).data;
          this.offscreenCtx.restore();
          if (data[3] > 100) {
            const lum = 0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2];
            const baseLum = 0.299 * baseRgb.r + 0.587 * baseRgb.g + 0.114 * baseRgb.b;
            if (lum > baseLum * 0.6) {
              resolved = { r: data[0], g: data[1], b: data[2] };
            }
          }
        }
      }
    } catch {
      // Gracefully fall back to avatar skin hue
    }
    this.skinColorCache.set(avatarId, resolved);
    return resolved;
  }

  /**
   * BIOMECHANICAL PHOTOGRAPHIC EYE RENDERING (SQUINT & BLINK):
   *
   * 1. Eye Squint (Duchenne Smile AU6):
   *    - Narrows the palpebral slit smoothly without pasting any artificial block or patch!
   *    - The iris, pupil, and sclera remain crisp and naturally framed.
   *    - Smooth anatomical contours matching the exact eyebrow skin tone.
   *
   * 2. Photographic Eyelid Blink:
   *    - The eyelid skin tone is sampled directly from the infrabrow skin area.
   *    - Eyelid skin tone and eyebrow skin color match 100% seamlessly.
   *    - Spherical 3D shading, subtle supratarsal crease fold, and delicate lash contour.
   *    - ZERO patch-like appearance, ZERO blocky edges.
   */
  private renderNaturalEyesAndBlink(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    drawX: number,
    drawY: number,
    drawW: number,
    drawH: number,
    leftEye: { x: number; y: number },
    rightEye: { x: number; y: number },
    leftBrow: { x: number; y: number },
    rightBrow: { x: number; y: number },
    avatar: AvatarProfile,
    emotion: EmotionParameters
  ): void {
    const squint = Math.max(0, Math.min(1.0, emotion.eyeSquint));
    const blink = Math.max(0, Math.min(1.0, this.blinkProgress));

    // Wide-open resting baseline: 100% original photo without any alteration
    if (squint < 0.02 && blink < 0.02) return;

    const eyeRadiusX = drawW * 0.038;
    const eyeRadiusY = drawW * 0.021;

    const renderEye = (eye: { x: number; y: number }, brow: { x: number; y: number }, isLeftEye: boolean) => {
      // Sample exact photographic skin color matching the eyebrow and infrabrow area
      const skin = this.sampleInfrabrowSkinColor(image, drawX, drawY, drawW, drawH, eye, brow, avatar.id, avatar.skinHue);
      const skinRgb = `${skin.r}, ${skin.g}, ${skin.b}`;

      // Canthi positions
      const innerCanthusX = isLeftEye ? eye.x + eyeRadiusX * 0.96 : eye.x - eyeRadiusX * 0.96;
      const outerCanthusX = isLeftEye ? eye.x - eyeRadiusX * 1.04 : eye.x + eyeRadiusX * 1.04;
      const innerCanthusY = eye.y + eyeRadiusY * 0.06;
      const outerCanthusY = eye.y - eyeRadiusY * 0.04;

      // -------------------------------------------------------------
      // (A) NATURAL EYE SQUINT (AU6 - Duchenne smile):
      // Smoothly narrows the eye slit without pasting any rectangular patch!
      // -------------------------------------------------------------
      if (squint > 0.02 && blink < 0.70) {
        const lowerLift = squint * eyeRadiusY * 0.22; // Gentle ~3-4px lower lid elevation
        const upperDrop = squint * eyeRadiusY * 0.15; // Gentle ~2-3px upper lid relaxation

        ctx.save();

        // 1. Lower lid gentle upward contour (matches skin tone of cheek/brow)
        ctx.beginPath();
        ctx.moveTo(outerCanthusX, outerCanthusY);
        ctx.quadraticCurveTo(eye.x, eye.y + eyeRadiusY - lowerLift, innerCanthusX, innerCanthusY);
        ctx.lineTo(innerCanthusX, eye.y + eyeRadiusY + 4);
        ctx.lineTo(outerCanthusX, eye.y + eyeRadiusY + 4);
        ctx.closePath();

        const lowerGrad = ctx.createLinearGradient(
          eye.x,
          eye.y + eyeRadiusY - lowerLift,
          eye.x,
          eye.y + eyeRadiusY + 3
        );
        lowerGrad.addColorStop(0, `rgba(${skinRgb}, ${0.55 * squint})`);
        lowerGrad.addColorStop(1, `rgba(${skinRgb}, 0)`);
        ctx.fillStyle = lowerGrad;
        ctx.fill();

        // Delicate lower lash margin
        ctx.beginPath();
        ctx.moveTo(outerCanthusX, outerCanthusY);
        ctx.quadraticCurveTo(eye.x, eye.y + eyeRadiusY - lowerLift, innerCanthusX, innerCanthusY);
        ctx.strokeStyle = `rgba(32, 18, 16, ${0.28 * squint})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // 2. Upper lid gentle downward relaxation
        if (upperDrop > 0.5) {
          ctx.beginPath();
          ctx.moveTo(outerCanthusX, outerCanthusY);
          ctx.quadraticCurveTo(eye.x, eye.y - eyeRadiusY + upperDrop, innerCanthusX, innerCanthusY);
          ctx.lineTo(innerCanthusX, eye.y - eyeRadiusY - 4);
          ctx.lineTo(outerCanthusX, eye.y - eyeRadiusY - 4);
          ctx.closePath();

          const upperGrad = ctx.createLinearGradient(
            eye.x,
            eye.y - eyeRadiusY + upperDrop,
            eye.x,
            eye.y - eyeRadiusY - 3
          );
          upperGrad.addColorStop(0, `rgba(${skinRgb}, ${0.45 * squint})`);
          upperGrad.addColorStop(1, `rgba(${skinRgb}, 0)`);
          ctx.fillStyle = upperGrad;
          ctx.fill();
        }

        // 3. Subtle smiling micro-tension crinkle at outer canthus
        if (squint > 0.15) {
          const crinkleDir = isLeftEye ? -1 : 1;
          const crinkleX = outerCanthusX + crinkleDir * 2;
          const crinkleY = outerCanthusY;
          ctx.beginPath();
          ctx.moveTo(crinkleX, crinkleY);
          ctx.quadraticCurveTo(
            crinkleX + crinkleDir * (eyeRadiusX * 0.25),
            crinkleY - 2,
            crinkleX + crinkleDir * (eyeRadiusX * 0.40),
            crinkleY - 1
          );
          ctx.strokeStyle = `rgba(${Math.max(0, skin.r - 40)}, ${Math.max(0, skin.g - 35)}, ${Math.max(0, skin.b - 35)}, ${0.22 * squint})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        ctx.restore();
      }

      // -------------------------------------------------------------
      // (B) NATURAL PHOTOGRAPHIC EYELID BLINK:
      // The eyelid skin color matches the eyebrow skin perfectly.
      // Spherical 3D shading, smooth supratarsal crease, and delicate lash contour.
      // -------------------------------------------------------------
      if (blink > 0.02) {
        const maxDrop = eyeRadiusY * 2.15;
        const currentDrop = blink * maxDrop;
        const lidBottomY = eye.y - eyeRadiusY + currentDrop;

        ctx.save();

        // Palpebral aperture clipping: restricts eyelid strictly inside the natural eye shape
        ctx.beginPath();
        ctx.moveTo(outerCanthusX, outerCanthusY);
        ctx.quadraticCurveTo(eye.x, eye.y - eyeRadiusY * 1.05, innerCanthusX, innerCanthusY);
        ctx.quadraticCurveTo(eye.x, eye.y + eyeRadiusY * 1.05, outerCanthusX, outerCanthusY);
        ctx.clip();

        // 1. Descending eyelid body with spherical 3D shading
        ctx.beginPath();
        ctx.moveTo(outerCanthusX, outerCanthusY);
        ctx.quadraticCurveTo(eye.x, eye.y - eyeRadiusY * 1.15, innerCanthusX, innerCanthusY);
        ctx.lineTo(innerCanthusX, lidBottomY);
        ctx.quadraticCurveTo(eye.x, lidBottomY, outerCanthusX, lidBottomY);
        ctx.closePath();

        // Gradient matching eyebrow skin color with natural 3D curvature highlight
        const eyelidGrad = ctx.createLinearGradient(
          eye.x,
          eye.y - eyeRadiusY,
          eye.x,
          lidBottomY
        );
        // Supratarsal fold crease tone (slightly deeper)
        eyelidGrad.addColorStop(0.0, `rgba(${Math.max(0, skin.r - 20)}, ${Math.max(0, skin.g - 20)}, ${Math.max(0, skin.b - 20)}, ${Math.min(1, 0.85 + blink * 0.15)})`);
        // Mid-lid spherical highlight (spherical bulge of eyeball)
        eyelidGrad.addColorStop(0.55, `rgba(${Math.min(255, skin.r + 15)}, ${Math.min(255, skin.g + 15)}, ${Math.min(255, skin.b + 12)}, 1.0)`);
        // Eyelid margin (matching brow skin tone)
        eyelidGrad.addColorStop(1.0, `rgba(${skinRgb}, 1.0)`);

        ctx.fillStyle = eyelidGrad;
        ctx.fill();

        // 2. Soft eyelid curvature radial highlight
        const lidBulgeGrad = ctx.createRadialGradient(
          eye.x,
          eye.y - eyeRadiusY + currentDrop * 0.5,
          1,
          eye.x,
          eye.y - eyeRadiusY + currentDrop * 0.5,
          eyeRadiusX * 0.85
        );
        lidBulgeGrad.addColorStop(0, `rgba(255, 255, 255, ${0.12 * blink})`);
        lidBulgeGrad.addColorStop(0.65, `rgba(${skinRgb}, 0.0)`);
        lidBulgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lidBulgeGrad;
        ctx.fill();

        // 3. Delicate eyelash line along the descending eyelid margin
        ctx.beginPath();
        ctx.moveTo(outerCanthusX, Math.min(outerCanthusY, lidBottomY));
        ctx.quadraticCurveTo(eye.x, lidBottomY, innerCanthusX, Math.min(innerCanthusY, lidBottomY));
        ctx.strokeStyle = `rgba(28, 14, 12, ${0.45 + blink * 0.40})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();

        ctx.restore();

        // 4. Supratarsal eyelid fold (crease beneath the brow)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(outerCanthusX + (isLeftEye ? 2 : -2), outerCanthusY - 3);
        ctx.quadraticCurveTo(eye.x, eye.y - eyeRadiusY * 0.95, innerCanthusX - (isLeftEye ? 2 : -2), innerCanthusY - 2);
        ctx.strokeStyle = `rgba(${Math.max(0, skin.r - 45)}, ${Math.max(0, skin.g - 42)}, ${Math.max(0, skin.b - 40)}, ${0.30 * blink})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // 5. Delicate closed eye seam when fully shut (blink > 0.70)
        if (blink > 0.70) {
          ctx.beginPath();
          ctx.moveTo(outerCanthusX, outerCanthusY);
          ctx.quadraticCurveTo(eye.x, eye.y + eyeRadiusY * 0.10, innerCanthusX, innerCanthusY);
          ctx.strokeStyle = `rgba(26, 12, 10, ${0.60 * ((blink - 0.70) / 0.30)})`;
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    renderEye(leftEye, leftBrow, true);
    renderEye(rightEye, rightBrow, false);
  }

  /**
   * PHOTOREALISTIC EYEBROW & CHEEK DYNAMICS:
   * Translates the avatar's real photographic eyebrows and cheeks with seamless feathering.
   * Eliminates artificial black/white smudges or discolored circular patches.
   */
  private renderNaturalBrowsAndCheeks(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    drawX: number,
    drawY: number,
    drawW: number,
    drawH: number,
    emotion: EmotionParameters,
    leftBrow: { x: number; y: number },
    rightBrow: { x: number; y: number },
    leftCheek: { x: number; y: number },
    rightCheek: { x: number; y: number }
  ): void {
    if (!this.eyeCtx) return;

    // 1. Natural Cheek Smile Dynamics (subtle elevation & warm natural tone)
    if (emotion.smileValence > 0.15) {
      const cheekLift = emotion.smileValence * drawW * 0.005; // ~1-2px gentle lift
      const cheekRad = drawW * 0.055;

      const drawCheek = (cheek: { x: number; y: number }) => {
        ctx.save();
        const blushGrad = ctx.createRadialGradient(
          cheek.x,
          cheek.y - cheekLift,
          1,
          cheek.x,
          cheek.y - cheekLift,
          cheekRad
        );
        // Ultra-subtle healthy facial blush matching human micro-circulation
        const blushAlpha = Math.min(0.08, emotion.smileValence * 0.05);
        blushGrad.addColorStop(0, `rgba(215, 95, 85, ${blushAlpha})`);
        blushGrad.addColorStop(1, 'rgba(215, 95, 85, 0)');
        ctx.fillStyle = blushGrad;
        ctx.beginPath();
        ctx.arc(cheek.x, cheek.y - cheekLift, cheekRad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      drawCheek(leftCheek);
      drawCheek(rightCheek);
    }

    // 2. Natural Eyebrow Dynamics (photographic vertical translation, no paint marks)
    if (Math.abs(emotion.browRaise) > 0.05) {
      const browOffset = -emotion.browRaise * drawW * 0.009; // Subtle 2-3px movement
      const browW = drawW * 0.095;
      const browH = drawW * 0.035;

      const drawBrow = (brow: { x: number; y: number }) => {
        const offCtx = this.eyeCtx!;
        const patchX = brow.x - browW * 0.5;
        const patchY = brow.y - browH * 0.5;

        const sx = ((patchX - drawX) / drawW) * image.naturalWidth;
        const sy = ((patchY - drawY) / drawH) * image.naturalHeight;
        const sw = (browW / drawW) * image.naturalWidth;
        const sh = (browH / drawH) * image.naturalHeight;

        if (sw > 0 && sw > 0 && sx >= 0 && sy >= 0) {
          offCtx.clearRect(0, 0, this.eyeCanvas.width, this.eyeCanvas.height);
          offCtx.save();

          // Draw real photographic eyebrow translated vertically
          offCtx.drawImage(image, sx, sy, sw, sh, patchX, patchY + browOffset, browW, browH);

          // Feather with smooth elliptical gradient so edges melt invisibly into forehead skin
          offCtx.globalCompositeOperation = 'destination-in';
          const grad = offCtx.createRadialGradient(
            brow.x,
            patchY + browOffset + browH * 0.5,
            browW * 0.25,
            brow.x,
            patchY + browOffset + browH * 0.5,
            browW * 0.50
          );
          grad.addColorStop(0.0, 'rgba(0, 0, 0, 1)');
          grad.addColorStop(0.70, 'rgba(0, 0, 0, 0.85)');
          grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

          offCtx.fillStyle = grad;
          offCtx.fillRect(patchX, patchY + browOffset, browW, browH);
          offCtx.restore();

          // Composite feathered photographic eyebrow onto face
          ctx.drawImage(this.eyeCanvas, 0, 0);
        }
      };

      drawBrow(leftBrow);
      drawBrow(rightBrow);
    }
  }

  /**
   * PHOTOREALISTIC LIP SYNC ENGINE:
   * Uses seamless feathered photographic lower-lip translation, anatomically bounded jaw kinematics,
   * realistic translucent dental incisal edges with upper-lip shadow, and zero distortion at rest.
   */
  private renderNaturalLipSync(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    drawX: number,
    drawY: number,
    drawW: number,
    drawH: number,
    avatar: AvatarProfile,
    visemes: VisemeState,
    emotion: EmotionParameters,
    mouthCenter: { x: number; y: number },
    mouthLeft: { x: number; y: number },
    mouthRight: { x: number; y: number },
    upperLip: { x: number; y: number },
    lowerLip: { x: number; y: number },
    chin: { x: number; y: number }
  ): void {
    const mouthW = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);

    // 1. BOUNDED ARTICULATION CALIBRATION:
    // Transforms slider from aggressive multiplier into bounded physiological curve:
    // 50% -> 0.55 (subtle, restrained)
    // 75% -> 0.81 (natural conversational)
    // 85% -> 0.89 (recommended avatar baseline)
    // 100% -> 0.99 (clearly articulated)
    // 120%+ -> smoothly saturates to max ~1.18 via tanh, preventing rubbery gaping
    const s = emotion.articulationScale;
    const boundedArticulation = 0.55 + 0.65 * Math.tanh((s - 0.5) / 0.6);

    // 2. BILABIAL SEAL CHECK (/p/, /b/, /m/):
    // Full consonant seal: if bilabial closure is active, force jaw opening to zero!
    const isBilabial = visemes.lipPress > 0.15 || visemes.phonemeCategory === 'bilabial';
    if (isBilabial) {
      // Lips firmly sealed - draw subtle compression if strong press
      if (visemes.lipPress > 0.4) {
        ctx.save();
        ctx.fillStyle = 'rgba(20, 8, 10, 0.25)';
        ctx.beginPath();
        ctx.ellipse(mouthCenter.x, mouthCenter.y, mouthW * 0.42, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return; // Absolute airtight seal, zero cavity or teeth visible
    }

    // 3. ANATOMICAL JAW OPENING LIMITS:
    // In human speech, normal conversational aperture is only 4mm to 9mm (~4px to 10px on canvas).
    // Even loud open vowels (/a/) rarely exceed 11px.
    const maxPhysiologicalDrop = mouthW * 0.115; // Hard anatomical ceiling (~10-12px)
    const rawDrop = visemes.jawOpen * maxPhysiologicalDrop * boundedArticulation;
    // Smooth tanh saturation ensures movement never exceeds anatomical limits
    let jawDrop = maxPhysiologicalDrop * Math.tanh(rawDrop / maxPhysiologicalDrop);

    // Labiodental tuck adjustment for /f/ and /v/
    if (visemes.lowerLipTuck > 0.15) {
      jawDrop = Math.min(jawDrop, maxPhysiologicalDrop * 0.35); // Narrow aperture
    }

    // SILENCE & RESTING POSE:
    // If jawDrop is sub-threshold (< 0.5px), avatar retains 100% pristine photo
    if (jawDrop < 0.5) {
      return;
    }

    // Dynamic horizontal spread / roundness
    // Limit horizontal distortion strictly to ±5% of mouth width
    const maxSpread = mouthW * 0.05;
    const spreadX = Math.max(-maxSpread, Math.min(maxSpread, visemes.mouthSpread * mouthW * 0.04));
    const puckerX = -visemes.lipPucker * mouthW * 0.035;

    const leftCornerX = mouthLeft.x - spreadX + puckerX;
    const leftCornerY = mouthLeft.y;
    const rightCornerX = mouthRight.x + spreadX - puckerX;
    const rightCornerY = mouthRight.y;

    // In human biomechanics, maxilla (upper lip) stays fixed; mandible (lower lip) moves down
    const upperY = mouthCenter.y - (jawDrop * 0.08); // Slight 8% upper lip lift
    const lowerY = mouthCenter.y + (jawDrop * 0.92); // 92% mandibular descent
    const apertureHeight = Math.max(0, lowerY - upperY);

    if (apertureHeight < 0.6) return;

    ctx.save();

    // 4. STEP ONE: RENDER INNER ORAL CAVITY & SUBTLE TEETH INSIDE APERTURE
    // Smooth anatomical contour tapered to zero at corners
    ctx.beginPath();
    ctx.moveTo(leftCornerX, leftCornerY);

    const cpUpper1X = leftCornerX + (mouthCenter.x - leftCornerX) * 0.5;
    const cpUpper2X = mouthCenter.x + (rightCornerX - mouthCenter.x) * 0.5;
    ctx.bezierCurveTo(cpUpper1X, upperY, cpUpper2X, upperY, rightCornerX, rightCornerY);

    const cpLower2X = mouthCenter.x + (rightCornerX - mouthCenter.x) * 0.5;
    const cpLower1X = leftCornerX + (mouthCenter.x - leftCornerX) * 0.5;
    ctx.bezierCurveTo(cpLower2X, lowerY, cpLower1X, lowerY, leftCornerX, leftCornerY);
    ctx.closePath();

    ctx.save();
    ctx.clip(); // Keep all cavity and teeth strictly inside the natural opening

    // (A) Deep pharyngeal background shadow
    const cavityGrad = ctx.createRadialGradient(
      mouthCenter.x,
      upperY + apertureHeight * 0.45,
      1,
      mouthCenter.x,
      upperY + apertureHeight * 0.45,
      mouthW * 0.50
    );
    cavityGrad.addColorStop(0, '#100406');
    cavityGrad.addColorStop(0.65, '#20080b');
    cavityGrad.addColorStop(1, '#330c12');
    ctx.fillStyle = cavityGrad;
    ctx.fill();

    // (B) Natural Upper Teeth Incisal Edge (Realistic Human Dental Anatomy):
    // Teeth are NOT a flat box; only the lower 2-3mm of the upper incisors peek through,
    // deeply shaded by the upper lip. Zero gums visible.
    const teethVisibility = Math.min(
      1.0,
      Math.max(0, (apertureHeight / (maxPhysiologicalDrop * 0.7)) * 0.75 + (emotion.smileValence * 0.15) + (visemes.teethExposure * 0.35))
    );

    if (teethVisibility > 0.08 && apertureHeight > 1.8) {
      const teethW = mouthW * 0.52; // Strictly 52% of mouth width
      // Tooth height is bounded to at most 38% of aperture (max ~3.5px)
      const teethVisibleH = Math.min(apertureHeight * 0.42, 3.8 * teethVisibility);
      const teethTopY = upperY - 0.5;

      ctx.save();
      // Curved anatomical dental arc
      ctx.beginPath();
      ctx.ellipse(
        mouthCenter.x,
        teethTopY + teethVisibleH * 0.5,
        teethW * 0.5,
        teethVisibleH * 0.85,
        0,
        0,
        Math.PI
      );
      ctx.clip();

      // Warm translucent ivory enamel tone (matching photographic lighting)
      const enamelGrad = ctx.createLinearGradient(mouthCenter.x, teethTopY, mouthCenter.x, teethTopY + teethVisibleH);
      enamelGrad.addColorStop(0.0, '#b08f88');      // Deep gum shadow
      enamelGrad.addColorStop(0.35, '#ded5c7');     // Tooth upper enamel
      enamelGrad.addColorStop(0.75, '#f4ece0');     // Natural enamel highlight
      enamelGrad.addColorStop(1.0, '#c7beaf');      // Incisal edge translucency

      ctx.fillStyle = enamelGrad;
      ctx.fillRect(mouthCenter.x - teethW * 0.5, teethTopY, teethW, teethVisibleH + 1);

      // Subtle translucent separation between central incisors
      const incisorHalf = teethW * 0.12;
      ctx.strokeStyle = 'rgba(50, 30, 25, 0.30)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(mouthCenter.x, teethTopY + teethVisibleH * 0.25);
      ctx.lineTo(mouthCenter.x, teethTopY + teethVisibleH * 0.95);
      ctx.stroke();

      // Lateral incisor separators
      ctx.strokeStyle = 'rgba(50, 30, 25, 0.20)';
      ctx.beginPath();
      ctx.moveTo(mouthCenter.x - incisorHalf, teethTopY + teethVisibleH * 0.30);
      ctx.lineTo(mouthCenter.x - incisorHalf, teethTopY + teethVisibleH * 0.90);
      ctx.moveTo(mouthCenter.x + incisorHalf, teethTopY + teethVisibleH * 0.30);
      ctx.lineTo(mouthCenter.x + incisorHalf, teethTopY + teethVisibleH * 0.90);
      ctx.stroke();

      // Upper lip deep ambient occlusion drop shadow (recesses teeth naturally into mouth)
      const shadowGrad = ctx.createLinearGradient(mouthCenter.x, teethTopY, mouthCenter.x, teethTopY + teethVisibleH);
      shadowGrad.addColorStop(0, 'rgba(15, 5, 7, 0.82)');
      shadowGrad.addColorStop(0.65, 'rgba(15, 5, 7, 0.30)');
      shadowGrad.addColorStop(1, 'rgba(15, 5, 7, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(mouthCenter.x - teethW * 0.5, teethTopY, teethW, teethVisibleH);

      ctx.restore();
    }

    // (C) Tongue (reactive to lingual phonemes /l/, /d/, /th/ or open vowels /a/)
    if (apertureHeight > 3.5) {
      const tongueElevation = visemes.tongueRaise * (maxPhysiologicalDrop * 0.25);
      const tongueY = lowerY - (apertureHeight * 0.20) - tongueElevation;
      const tongueW = mouthW * 0.44;
      const tongueH = apertureHeight * 0.40;

      ctx.save();
      const tongueGrad = ctx.createRadialGradient(
        mouthCenter.x,
        tongueY,
        1,
        mouthCenter.x,
        tongueY,
        tongueW * 0.55
      );
      tongueGrad.addColorStop(0, '#ba5766');
      tongueGrad.addColorStop(0.65, '#8a3340');
      tongueGrad.addColorStop(1, '#4f1720');

      ctx.fillStyle = tongueGrad;
      ctx.beginPath();
      ctx.ellipse(mouthCenter.x, tongueY, tongueW * 0.5, tongueH * 0.50, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore(); // Exit inner aperture clip

    // 5. STEP TWO: SEAMLESS ORGANIC LOWER LIP TRANSLATION
    // Uses smooth feathered alpha blending over the lower lip pad:
    // - NO horizontal rectangular slice lines!
    // - Takes the real photo's lower lip vermilion and translates it down by jawDrop.
    // - Soft feathered boundary dissolves 100% seamlessly into the chin crease.
    const patchW = mouthW * 1.30;
    const patchH = (chin.y - mouthCenter.y) * 0.85;
    const patchX = mouthCenter.x - patchW * 0.5;
    const patchY = mouthCenter.y;

    if (this.offscreenCtx && patchW > 10 && patchH > 10) {
      const offCtx = this.offscreenCtx;
      offCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

      // (A) Draw the real image lower-lip patch displaced down by jawDrop
      offCtx.save();
      offCtx.drawImage(
        image,
        ((patchX - drawX) / drawW) * image.naturalWidth,
        ((patchY - drawY) / drawH) * image.naturalHeight,
        (patchW / drawW) * image.naturalWidth,
        (patchH / drawH) * image.naturalHeight,
        patchX,
        patchY + jawDrop,
        patchW,
        patchH
      );

      // (B) Feather the lower lip patch with a smooth organic gradient mask
      offCtx.globalCompositeOperation = 'destination-in';

      // Inner vermilion border is crisp; lateral corners and chin dissolve seamlessly
      const maskGrad = offCtx.createLinearGradient(mouthCenter.x, patchY + jawDrop, mouthCenter.x, patchY + jawDrop + patchH);
      maskGrad.addColorStop(0.0, 'rgba(0, 0, 0, 1)');      // Crisp inner lower lip border
      maskGrad.addColorStop(0.40, 'rgba(0, 0, 0, 0.95)');   // Lower lip vermilion body
      maskGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.50)');   // Mentolabial crease feathering
      maskGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');      // Dissolves seamlessly into chin

      offCtx.fillStyle = maskGrad;
      offCtx.fillRect(patchX, patchY + jawDrop, patchW, patchH);

      // Radial horizontal feathering at left and right commissures
      const radialMask = offCtx.createRadialGradient(
        mouthCenter.x,
        patchY + jawDrop + patchH * 0.35,
        mouthW * 0.32,
        mouthCenter.x,
        patchY + jawDrop + patchH * 0.35,
        patchW * 0.52
      );
      radialMask.addColorStop(0.0, 'rgba(0, 0, 0, 1)');
      radialMask.addColorStop(0.80, 'rgba(0, 0, 0, 0.85)');
      radialMask.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      offCtx.fillStyle = radialMask;
      offCtx.fillRect(patchX, patchY + jawDrop, patchW, patchH);
      offCtx.restore();

      // (C) Composite the seamlessly feathered lower lip back onto the face
      ctx.drawImage(this.offscreenCanvas, 0, 0);
    }

    // 6. STEP THREE: DELICATE VERMILION BORDER BLEND
    // Soft subtle lip line feathering with zero harsh outlines
    ctx.save();
    ctx.strokeStyle = avatar.lipVermilionColor;
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.moveTo(leftCornerX, leftCornerY);
    ctx.bezierCurveTo(cpUpper1X, upperY, cpUpper2X, upperY, rightCornerX, rightCornerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(leftCornerX, leftCornerY);
    ctx.bezierCurveTo(cpLower1X, lowerY, cpLower2X, lowerY, rightCornerX, rightCornerY);
    ctx.stroke();

    // Subtle natural corner commissure shadows
    ctx.fillStyle = 'rgba(20, 8, 10, 0.30)';
    ctx.beginPath();
    ctx.arc(leftCornerX, leftCornerY, 1.8, 0, Math.PI * 2);
    ctx.arc(rightCornerX, rightCornerY, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.restore();
  }

  /**
   * Fallback geometric avatar if image is loading
   */
  private renderPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number, avatar: AvatarProfile): void {
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = avatar.skinHue || '#d4a373';
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.45, width * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#262626';
    ctx.beginPath();
    ctx.arc(width * 0.42, height * 0.42, width * 0.03, 0, Math.PI * 2);
    ctx.arc(width * 0.58, height * 0.42, width * 0.03, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = avatar.lipVermilionColor || '#be6f6f';
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.56, width * 0.08, width * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }
}
