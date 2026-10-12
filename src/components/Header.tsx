import React from 'react';
import { Video, Square } from 'lucide-react';

interface HeaderProps {
  activeTab: 'studio' | 'benchmark' | 'tts' | 'mic' | 'chat';
  setActiveTab: (tab: 'studio' | 'benchmark' | 'tts' | 'mic' | 'chat') => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  recordingSeconds: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isRecording,
  onStartRecording,
  onStopRecording,
  recordingSeconds,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Single-element brand wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
          VividSync
        </span>
        <span className="hidden sm:inline-block text-xs text-neutral-400 font-normal">
          Real-Time Lip-Sync Studio
        </span>
      </div>

      {/* Zone 2: Concise navigation links (single line, no wrapping) */}
      <nav className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => setActiveTab('studio')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'studio'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Avatar Studio
        </button>

        <button
          onClick={() => setActiveTab('benchmark')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'benchmark'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Naturalness Test
        </button>

        <button
          onClick={() => setActiveTab('tts')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'tts'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Neural Speech & Script
        </button>

        <button
          onClick={() => setActiveTab('mic')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'mic'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Live Microphone
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Interactive Chat
        </button>
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="flex items-center gap-3 shrink-0">
        {isRecording ? (
          <button
            onClick={onStopRecording}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop Recording ({formatTime(recordingSeconds)})</span>
          </button>
        ) : (
          <button
            onClick={onStartRecording}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          >
            <Video className="w-3.5 h-3.5 text-neutral-300" />
            <span>Record Video</span>
          </button>
        )}
      </div>
    </header>
  );
};
