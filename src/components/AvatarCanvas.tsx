import React, { useEffect, useRef, useState } from 'react';
import { Camera, Maximize2, Minimize2, ZoomIn, Eye, Sparkles } from 'lucide-react';
import { AvatarProfile, VisemeState } from '../types/avatar';
import { EmotionParameters } from '../types/emotion';
import { AudioVisemeAnalyzer } from '../utils/audioAnalyzer';
import { FaceRenderer } from '../utils/faceRenderer';

interface AvatarCanvasProps {
  avatar: AvatarProfile;
  emotionParams: EmotionParameters;
  emotionKey: string;
  audioAnalyzer: AudioVisemeAnalyzer;
  onSnapshotTaken?: (dataUrl: string) => void;
  canvasRefOut?: React.RefObject<HTMLCanvasElement | null>;
  isSpeaking: boolean;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  avatar,
  emotionParams,
  emotionKey,
  audioAnalyzer,
  onSnapshotTaken,
  canvasRefOut,
  isSpeaking,
}) => {
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = canvasRefOut || localCanvasRef;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [zoomLevel, setZoomLevel] = useState<'portrait' | 'closeup' | 'wide'>('portrait');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentVisemes, setCurrentVisemes] = useState<VisemeState>({
    jawOpen: 0,
    mouthSpread: 0,
    lipPucker: 0,
    lipPress: 0,
    teethExposure: 0,
    tongueRaise: 0,
    lowerLipTuck: 0,
    audioEnergy: 0,
  });

  const rendererRef = useRef<FaceRenderer>(new FaceRenderer());
  const avatarImageRef = useRef<HTMLImageElement | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);

  // Load avatar image
  useEffect(() => {
    setIsImageLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.src = avatar.imageSrc;
    img.onload = () => {
      avatarImageRef.current = img;
      setIsImageLoaded(true);
    };
    img.onerror = () => {
      console.warn('Failed to load avatar image:', avatar.imageSrc);
      avatarImageRef.current = null;
      setIsImageLoaded(false);
    };
  }, [avatar.imageSrc]);

  // Animation frame loop
  useEffect(() => {
    let animationId: number;
    let startTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000;
      const canvas = canvasRef.current;

      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Get current visemes from analyzer
          const visemes = audioAnalyzer.getCurrentVisemes(emotionParams.articulationScale);
          setCurrentVisemes(visemes);

          rendererRef.current.render(ctx, canvas.width, canvas.height, {
            time: elapsed,
            avatar,
            image: avatarImageRef.current,
            visemes,
            emotion: emotionParams,
            zoomLevel,
          });
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [avatar, emotionParams, zoomLevel, audioAnalyzer, canvasRef]);

  // Snapshot handler
  const handleTakeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (onSnapshotTaken) {
      onSnapshotTaken(dataUrl);
    }
    const link = document.createElement('a');
    link.download = `${avatar.name.toLowerCase().replace(/\s+/g, '_')}_${emotionKey.toLowerCase()}_snapshot.png`;
    link.href = dataUrl;
    link.click();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl"
    >
      {/* Top Metadata Overlay (Unboxed Clean Typography) */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 text-xs text-neutral-300 bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800/80 pointer-events-auto">
          <span className="font-semibold text-white">{avatar.name}</span>
          <span aria-hidden="true" className="text-neutral-600">·</span>
          <span className="text-neutral-400">{avatar.role}</span>
          <span aria-hidden="true" className="text-neutral-600">·</span>
          <span className="text-emerald-400 font-medium">{emotionKey}</span>
          {isSpeaking && (
            <>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span className="text-sky-400 font-medium animate-pulse">Sync Active</span>
            </>
          )}
        </div>

        {/* Framing Controls */}
        <div className="flex items-center gap-1.5 bg-neutral-900/80 backdrop-blur-md p-1 rounded-lg border border-neutral-800/80 pointer-events-auto">
          <button
            onClick={() => setZoomLevel('closeup')}
            title="Close-up Focus"
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              zoomLevel === 'closeup' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Close-up
          </button>
          <button
            onClick={() => setZoomLevel('portrait')}
            title="Portrait Standard"
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              zoomLevel === 'portrait' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Portrait
          </button>
          <button
            onClick={() => setZoomLevel('wide')}
            title="Wide Studio"
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              zoomLevel === 'wide' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Wide
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="relative w-full max-w-[620px] aspect-square flex items-center justify-center bg-neutral-950">
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          className="w-full h-full object-contain"
        />

        {!isImageLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 text-sm gap-2">
            <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
            <span>Loading high-resolution avatar texture...</span>
          </div>
        )}
      </div>

      {/* Bottom Studio Action Bar (Clean UI - Zero Telemetry) */}
      <div className="w-full px-4 py-3 bg-neutral-900/90 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-neutral-300">Ultra-HD Canvas</span>
          </div>
          {isSpeaking && (
            <div className="flex items-center gap-1.5 text-sky-400">
              <span className="text-[11px] font-medium">Speaking</span>
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ height: '60%' }} />
                <span className="w-0.5 bg-sky-400 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ height: '100%' }} />
                <span className="w-0.5 bg-sky-400 rounded-full animate-bounce" style={{ height: '40%' }} />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTakeSnapshot}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title="Download high-resolution snapshot"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Snapshot</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
