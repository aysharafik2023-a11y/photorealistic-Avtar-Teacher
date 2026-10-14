import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react';
import { StartupState } from '../utils/startupService';

interface StartupBannerProps {
  startupState: StartupState;
  onRetry: () => void;
}

export const StartupBanner: React.FC<StartupBannerProps> = ({ startupState, onRetry }) => {
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  // When initializing or connecting, show an elegant inline progress pill
  if (
    startupState.stage === 'initializing' ||
    startupState.stage === 'loading-config' ||
    startupState.stage === 'connecting-realtime'
  ) {
    return (
      <div className="w-full bg-neutral-900/90 border-b border-neutral-800 px-4 py-2 flex items-center justify-between text-xs text-neutral-300 backdrop-blur-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 border-2 border-neutral-600 border-t-emerald-400 rounded-full animate-spin shrink-0" />
          <span className="font-medium text-white">{startupState.stageLabel}</span>
          <span className="text-neutral-500 hidden sm:inline">
            (Step {startupState.stage === 'initializing' ? '1/3' : startupState.stage === 'loading-config' ? '2/3' : '3/3'})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 sm:w-36 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${startupState.progress}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
            {startupState.progress}%
          </span>
        </div>
      </div>
    );
  }

  // When real-time backend connection fails, show notice with Retry button
  if (startupState.stage === 'connection-failed') {
    return (
      <div className="w-full bg-amber-950/40 border-b border-amber-900/60 px-4 py-2.5 text-xs text-amber-200">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-semibold text-white">Real-Time Service Unavailable:</span>{' '}
              <span className="text-amber-300">
                {startupState.errorMessage || 'Server unreachable on static host.'}{' '}
              </span>
              <span className="text-amber-200/80 hidden md:inline">
                Avatar animations, live mic, and browser speech remain fully functional.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setShowLogs((prev) => !prev)}
              className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 underline underline-offset-2 transition-colors cursor-pointer"
            >
              <span>{showLogs ? 'Hide details' : 'View diagnostics'}</span>
              {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-600/50 text-neutral-950 font-semibold text-xs rounded-md transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Retrying...' : 'Retry Connection'}</span>
            </button>
          </div>
        </div>

        {showLogs && (
          <div className="max-w-[1440px] mx-auto mt-2.5 p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg text-neutral-400 font-mono text-[11px] space-y-1">
            <div className="text-neutral-300 font-semibold mb-1 flex items-center gap-1.5">
              <span>Startup & Network Diagnostics:</span>
            </div>
            {startupState.logs.map((log, idx) => (
              <div key={idx} className="leading-tight">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // When Ready, show subtle indicator or nothing if connected
  return null;
};
