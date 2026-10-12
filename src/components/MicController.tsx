import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Sliders, Volume2 } from 'lucide-react';
import { AudioVisemeAnalyzer } from '../utils/audioAnalyzer';

interface MicControllerProps {
  audioAnalyzer: AudioVisemeAnalyzer;
  onMicStateChange: (active: boolean) => void;
}

export const MicController: React.FC<MicControllerProps> = ({
  audioAnalyzer,
  onMicStateChange,
}) => {
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(1.3);
  const [noiseGate, setNoiseGate] = useState<number>(0.02);
  const [currentDb, setCurrentDb] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    audioAnalyzer.sensitivity = sensitivity;
    audioAnalyzer.noiseFloor = noiseGate;
  }, [sensitivity, noiseGate, audioAnalyzer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, []);

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setMicStream(stream);
      await audioAnalyzer.connectMicrophone(stream);
      setIsMicActive(true);
      onMicStateChange(true);
      startVisualizer();
    } catch (err: any) {
      console.error('Microphone access denied or failed:', err);
      alert('Unable to access microphone. Please grant permission in your browser.');
    }
  };

  const stopMicrophone = () => {
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      setMicStream(null);
    }
    audioAnalyzer.disconnect();
    setIsMicActive(false);
    onMicStateChange(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setCurrentDb(0);
  };

  const toggleMic = () => {
    if (isMicActive) {
      stopMicrophone();
    } else {
      startMicrophone();
    }
  };

  // Live Oscilloscope Visualizer
  const startVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const visemes = audioAnalyzer.getCurrentVisemes();
      setCurrentDb(visemes.audioEnergy * 100);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw center line
      ctx.strokeStyle = '#262626';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Dynamic waveform
      const energy = visemes.audioEnergy;
      const amplitude = Math.min(canvas.height * 0.45, energy * canvas.height * 1.5);

      ctx.strokeStyle = energy > 0.05 ? '#10b981' : '#525252';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const time = performance.now() / 1000;
      for (let x = 0; x < canvas.width; x++) {
        const normX = x / canvas.width;
        const wave = Math.sin(normX * 16 + time * 12) * Math.sin(normX * Math.PI) * amplitude;
        const y = canvas.height / 2 + wave;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Live Microphone Input
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time zero-latency lip sync driven directly by your voice
          </p>
        </div>

        <button
          onClick={toggleMic}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-sm ${
            isMicActive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {isMicActive ? (
            <>
              <MicOff className="w-3.5 h-3.5" />
              <span>Mute Live Mic</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Start Live Mic</span>
            </>
          )}
        </button>
      </div>

      {/* Live Waveform Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950">
        <canvas
          ref={canvasRef}
          width={600}
          height={80}
          className="w-full h-20 object-cover"
        />

        <div className="absolute bottom-2 right-3 flex items-center gap-2 text-[11px] font-mono tabular-nums text-neutral-400">
          <span>Signal:</span>
          <span className={currentDb > 5 ? 'text-emerald-400 font-medium' : 'text-neutral-500'}>
            {currentDb.toFixed(1)} dB
          </span>
        </div>

        {!isMicActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 backdrop-blur-xs text-xs text-neutral-400">
            Click &ldquo;Start Live Mic&rdquo; to begin speaking to the avatar
          </div>
        )}
      </div>

      {/* Controls & Calibration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* Sensitivity */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-neutral-300">
            <span>Microphone Sensitivity</span>
            <span className="font-mono tabular-nums text-neutral-400">
              {(sensitivity * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-neutral-500">
            <span>Low (50%)</span>
            <span>Boosted (300%)</span>
          </div>
        </div>

        {/* Noise Gate */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-neutral-300">
            <span>Background Noise Gate</span>
            <span className="font-mono tabular-nums text-neutral-400">
              {(noiseGate * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.1"
            step="0.005"
            value={noiseGate}
            onChange={(e) => setNoiseGate(parseFloat(e.target.value))}
            className="w-full accent-sky-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-neutral-500">
            <span>Pass All (0%)</span>
            <span>Strict Filter (10%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
