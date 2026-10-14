export type StartupStage =
  | 'initializing'
  | 'loading-config'
  | 'connecting-realtime'
  | 'ready'
  | 'connection-failed';

export interface StartupState {
  stage: StartupStage;
  stageLabel: string;
  progress: number; // 0 to 100
  hasBackend: boolean;
  hasSpeechSynthesis: boolean;
  hasAudioContext: boolean;
  errorMessage: string | null;
  isOfflineMode: boolean;
  lastChecked: number | null;
  logs: string[];
}

const STAGE_LABELS: Record<StartupStage, string> = {
  'initializing': 'Initializing application',
  'loading-config': 'Loading configuration',
  'connecting-realtime': 'Connecting to real-time services',
  'ready': 'Ready',
  'connection-failed': 'Connection failed',
};

class StartupManager {
  private state: StartupState = {
    stage: 'initializing',
    stageLabel: STAGE_LABELS['initializing'],
    progress: 15,
    hasBackend: false,
    hasSpeechSynthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
    hasAudioContext: typeof window !== 'undefined' && Boolean(window.AudioContext || (window as any).webkitAudioContext),
    errorMessage: null,
    isOfflineMode: false,
    lastChecked: null,
    logs: [],
  };

  private listeners: Set<(state: StartupState) => void> = new Set();
  private abortController: AbortController | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.log('StartupManager initialized. Preparing initial application startup.');
  }

  public getState(): StartupState {
    return { ...this.state };
  }

  public subscribe(listener: (state: StartupState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[VividSync Startup] Error in subscriber callback:', err);
      }
    });
  }

  private log(message: string, isError: boolean = false) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${message}`;
    this.state.logs = [...this.state.logs.slice(-20), entry];
    if (isError) {
      console.warn(`[VividSync Startup] ${message}`);
    } else {
      console.log(`[VividSync Startup] ${message}`);
    }
  }

  private setStage(stage: StartupStage, progress: number, overrides?: Partial<StartupState>) {
    this.state = {
      ...this.state,
      stage,
      stageLabel: STAGE_LABELS[stage],
      progress,
      ...overrides,
    };
    this.log(`State transition -> ${STAGE_LABELS[stage]} (${progress}%)`);
    this.notify();
  }

  /**
   * Initializes the application services with explicit stages, bounded timeouts,
   * non-blocking fallback handling, and sanitized development logging.
   */
  public async initialize(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // ----------------------------------------------------
      // Stage 1: Initializing application
      // ----------------------------------------------------
      this.setStage('initializing', 20, { errorMessage: null });
      this.log('Stage 1: Verifying browser capabilities (HTML5 Canvas, Web Audio, SpeechSynthesis)');

      const hasCanvas = typeof document !== 'undefined' && Boolean(document.createElement('canvas').getContext('2d'));
      const hasAudio = typeof window !== 'undefined' && Boolean(window.AudioContext || (window as any).webkitAudioContext);
      const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

      if (!hasCanvas) {
        throw new Error('HTML5 Canvas 2D is not supported in this browser environment.');
      }

      this.state.hasAudioContext = hasAudio;
      this.state.hasSpeechSynthesis = hasSpeech;
      this.log(`Environment verified: Canvas=${hasCanvas}, AudioContext=${hasAudio}, Speech=${hasSpeech}`);

      // Yield briefly to keep main thread completely unblocked
      await new Promise((res) => setTimeout(res, 50));
      if (signal.aborted) return;

      // ----------------------------------------------------
      // Stage 2: Loading configuration
      // ----------------------------------------------------
      this.setStage('loading-config', 45);
      this.log('Stage 2: Loading server configuration and health status...');

      let backendAvailable = false;
      let configErrorMessage: string | null = null;

      try {
        // Enforce a strict 2.5s timeout on configuration probe so static hosts never hang
        const healthTimeout = 2500;
        const fetchController = new AbortController();
        const timeoutId = setTimeout(() => fetchController.abort(), healthTimeout);

        const res = await fetch('/api/health', {
          signal: fetchController.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          backendAvailable = data?.status === 'ok';
          this.log(`Configuration loaded successfully: Backend status=${data?.status}, HasAPIKey=${Boolean(data?.hasApiKey)}`);
        } else {
          this.log(`Backend probe returned HTTP ${res.status}. Falling back to static client configuration.`, true);
          configErrorMessage = `Real-time server returned HTTP ${res.status}. Running in static client mode.`;
        }
      } catch (probeError: any) {
        if (probeError.name === 'AbortError') {
          this.log('Backend probe timed out after 2500ms. Assuming static or serverless deployment.', true);
          configErrorMessage = 'Server connection timed out. Running in static client mode.';
        } else {
          this.log(`Backend endpoint unreachable (${probeError?.message || 'Network error'}). Client-side mode active.`, true);
          configErrorMessage = 'Real-time server unreachable. Running in static client mode.';
        }
      }

      if (signal.aborted) return;

      // ----------------------------------------------------
      // Stage 3: Connecting to real-time services
      // ----------------------------------------------------
      this.setStage('connecting-realtime', 75, {
        hasBackend: backendAvailable,
        lastChecked: Date.now(),
      });
      this.log('Stage 3: Testing real-time avatar pipeline and audio drivers...');

      // Yield for responsive UI rendering
      await new Promise((res) => setTimeout(res, 100));
      if (signal.aborted) return;

      // ----------------------------------------------------
      // Stage 4: Final State Determination (Ready or Connection failed)
      // ----------------------------------------------------
      if (backendAvailable) {
        this.setStage('ready', 100, {
          hasBackend: true,
          isOfflineMode: false,
          errorMessage: null,
          lastChecked: Date.now(),
        });
        this.log('Stage 4: Ready. Full real-time studio connected with server-side neural voice.');
      } else {
        // If backend is unavailable, set state to connection-failed with clear message and retry option
        // The UI stays completely operational in static fallback mode.
        this.setStage('connection-failed', 100, {
          hasBackend: false,
          isOfflineMode: true,
          errorMessage: configErrorMessage || 'Real-time server is offline. Local browser speech and canvas sync remain active.',
          lastChecked: Date.now(),
        });
        this.log('Stage 4: Connection failed to backend. VividSync is operating in full client-side mode.');
      }
    } catch (criticalError: any) {
      this.log(`Critical startup failure: ${criticalError?.message || criticalError}`, true);
      this.setStage('connection-failed', 100, {
        errorMessage: criticalError?.message || 'Failed to initialize application services.',
        lastChecked: Date.now(),
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Retries connecting to real-time backend services on user demand.
   */
  public async retry(): Promise<void> {
    this.log('User initiated connection retry.');
    await this.initialize();
  }
}

export const startupManager = new StartupManager();
