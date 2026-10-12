import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { AvatarCanvas } from './components/AvatarCanvas';
import { EmotionControls } from './components/EmotionControls';
import { SpeechStudio } from './components/SpeechStudio';
import { MicController } from './components/MicController';
import { ChatAssistant } from './components/ChatAssistant';
import { AvatarSelector } from './components/AvatarSelector';
import { NaturalnessBenchmark } from './components/NaturalnessBenchmark';
import { DEFAULT_AVATARS } from './data/defaultAvatars';
import { AvatarProfile } from './types/avatar';
import { EmotionPresetKey, EmotionParameters, EMOTION_PRESETS, DEFAULT_CALIBRATION_PARAMS } from './types/emotion';
import { AudioVisemeAnalyzer } from './utils/audioAnalyzer';
import { AvatarVideoRecorder } from './utils/recorder';
import { Sliders, Volume2, Mic, MessageSquare, Zap, Activity, Waves, Layers, ShieldCheck } from 'lucide-react';

export default function App() {
  const [avatarsList, setAvatarsList] = useState<AvatarProfile[]>(DEFAULT_AVATARS);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarProfile>(DEFAULT_AVATARS[0]);
  const [currentEmotionKey, setCurrentEmotionKey] = useState<EmotionPresetKey>('Neutral');
  const [emotionParams, setEmotionParams] = useState<EmotionParameters>({
    ...DEFAULT_CALIBRATION_PARAMS,
  });
  const [activeTab, setActiveTab] = useState<'studio' | 'benchmark' | 'tts' | 'mic' | 'chat'>('studio');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Audio and recording utilities
  const audioAnalyzerRef = useRef<AudioVisemeAnalyzer>(new AudioVisemeAnalyzer());
  const recorderRef = useRef<AvatarVideoRecorder>(new AvatarVideoRecorder());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Recording timer
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const recordingTimerRef = useRef<any>(null);

  // Synchronize preset changes
  const handleSelectPreset = (key: EmotionPresetKey) => {
    setCurrentEmotionKey(key);
    setEmotionParams({ ...EMOTION_PRESETS[key].params });
  };

  const handleResetParams = () => {
    setEmotionParams({ ...EMOTION_PRESETS[currentEmotionKey].params });
  };

  // Avatar switch
  const handleSelectAvatar = (avatar: AvatarProfile) => {
    setSelectedAvatar(avatar);
    if (avatar.defaultEmotion && avatar.defaultEmotion in EMOTION_PRESETS) {
      handleSelectPreset(avatar.defaultEmotion as EmotionPresetKey);
    }
  };

  const handleUploadCustomAvatar = (customAvatar: AvatarProfile) => {
    setAvatarsList((prev) => [customAvatar, ...prev]);
    setSelectedAvatar(customAvatar);
  };

  // Video recording
  const handleStartRecording = () => {
    if (!canvasRef.current) return;
    const ok = recorderRef.current.startRecording(
      canvasRef.current,
      audioAnalyzerRef.current.getContext()
    );
    if (ok) {
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleStopRecording = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    await recorderRef.current.stopRecording(
      `${selectedAvatar.name.toLowerCase().replace(/\s+/g, '_')}_lipsync_export.webm`
    );
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-neutral-800">
      {/* Top Bar Contract (Wordmark - Clean Links - Single Primary Action) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isRecording={isRecording}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        recordingSeconds={recordingSeconds}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Editorial Sub-Navigation / Mode Switcher Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-neutral-800/80 text-xs">
          {/* Metadata String */}
          <div className="flex items-center gap-2 text-neutral-400">
            <span className="text-white font-medium">{selectedAvatar.name}</span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span>{selectedAvatar.role}</span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span>24kHz Studio Audio</span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span className="font-mono tabular-nums text-neutral-400">60 FPS Real-time</span>
          </div>

          {/* Quick Mode Shortcuts */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'studio'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Studio & Emotions</span>
            </button>

            <button
              onClick={() => setActiveTab('benchmark')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'benchmark'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Naturalness Test</span>
            </button>

            <button
              onClick={() => setActiveTab('tts')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'tts'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Neural Speech</span>
            </button>

            <button
              onClick={() => setActiveTab('mic')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'mic'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Live Mic</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Interactive Chat</span>
            </button>
          </div>
        </div>

        {/* 2-Column Split: Canvas Viewport (Left) & Control Studio (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Avatar Real-time Canvas Display (5 cols on desktop) */}
          <div className="lg:col-span-5 space-y-4">
            <AvatarCanvas
              avatar={selectedAvatar}
              emotionParams={emotionParams}
              emotionKey={currentEmotionKey}
              audioAnalyzer={audioAnalyzerRef.current}
              canvasRefOut={canvasRef}
              isSpeaking={isSpeaking}
            />

            {/* Avatar Selector Card directly beneath canvas */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <AvatarSelector
                avatars={avatarsList}
                selectedAvatar={selectedAvatar}
                onSelectAvatar={handleSelectAvatar}
                onUploadCustomAvatar={handleUploadCustomAvatar}
              />
            </div>
          </div>

          {/* Right: Studio Workspace Panel (7 cols on desktop) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Tab 1: Studio & Emotion Calibration */}
            {activeTab === 'studio' && (
              <div className="space-y-5">
                <EmotionControls
                  currentPreset={currentEmotionKey}
                  onSelectPreset={handleSelectPreset}
                  emotionParams={emotionParams}
                  onChangeParams={setEmotionParams}
                  onResetParams={handleResetParams}
                />

                {/* Quick Neural Voice Trigger embedded inside Studio */}
                <SpeechStudio
                  avatar={selectedAvatar}
                  currentEmotion={currentEmotionKey}
                  audioAnalyzer={audioAnalyzerRef.current}
                  onSpeakingChange={setIsSpeaking}
                />
              </div>
            )}

            {/* Tab: Naturalness Benchmark & Stress Test */}
            {activeTab === 'benchmark' && (
              <div className="space-y-5">
                <NaturalnessBenchmark
                  avatar={selectedAvatar}
                  emotionParams={emotionParams}
                  onChangeArticulation={(val) => {
                    setEmotionParams((prev) => ({ ...prev, articulationScale: val }));
                  }}
                  audioAnalyzer={audioAnalyzerRef.current}
                  onSpeakingChange={setIsSpeaking}
                />

                <EmotionControls
                  currentPreset={currentEmotionKey}
                  onSelectPreset={handleSelectPreset}
                  emotionParams={emotionParams}
                  onChangeParams={setEmotionParams}
                  onResetParams={handleResetParams}
                />
              </div>
            )}

            {/* Tab 2: Neural Speech & Script Studio */}
            {activeTab === 'tts' && (
              <div className="space-y-5">
                <SpeechStudio
                  avatar={selectedAvatar}
                  currentEmotion={currentEmotionKey}
                  audioAnalyzer={audioAnalyzerRef.current}
                  onSpeakingChange={setIsSpeaking}
                />

                <EmotionControls
                  currentPreset={currentEmotionKey}
                  onSelectPreset={handleSelectPreset}
                  emotionParams={emotionParams}
                  onChangeParams={setEmotionParams}
                  onResetParams={handleResetParams}
                />
              </div>
            )}

            {/* Tab 3: Live Microphone */}
            {activeTab === 'mic' && (
              <div className="space-y-5">
                <MicController
                  audioAnalyzer={audioAnalyzerRef.current}
                  onMicStateChange={setIsSpeaking}
                />

                <EmotionControls
                  currentPreset={currentEmotionKey}
                  onSelectPreset={handleSelectPreset}
                  emotionParams={emotionParams}
                  onChangeParams={setEmotionParams}
                  onResetParams={handleResetParams}
                />
              </div>
            )}

            {/* Tab 4: Interactive Conversational Chat */}
            {activeTab === 'chat' && (
              <div className="space-y-5">
                <ChatAssistant
                  avatar={selectedAvatar}
                  currentEmotion={currentEmotionKey}
                  audioAnalyzer={audioAnalyzerRef.current}
                  onSpeakingChange={setIsSpeaking}
                />

                <EmotionControls
                  currentPreset={currentEmotionKey}
                  onSelectPreset={handleSelectPreset}
                  emotionParams={emotionParams}
                  onChangeParams={setEmotionParams}
                  onResetParams={handleResetParams}
                />
              </div>
            )}
          </div>
        </div>

        {/* Feature KPI Strip below Hero Grid (Clean unboxed technical proof) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-neutral-800">
          <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Zero-Latency Real-Time Sync</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              60 FPS hardware-accelerated canvas composite reacting instantaneously to live vocal formant transitions.
            </p>
          </div>

          <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>Phonetic Viseme Extraction</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Multi-band FFT analysis separates vowel height (jaw drop), vowel frontness (lip spread), and sibilants.
            </p>
          </div>

          <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>8 Customizable Emotions</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Fine-grained calibration for smile valence, eyebrow tension, Duchenne eye crinkles, and speaking cadence nods.
            </p>
          </div>

          <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Waves className="w-4 h-4 text-amber-400" />
              <span>Neural Voice Synthesis</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Server-side Gemini 24kHz unary audio with multiple distinct vocal timbres and conversational intelligence.
            </p>
          </div>
        </div>
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="border-t border-neutral-800/80 px-6 py-4 mt-8 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span>VividSync Real-Time Avatar Studio</span>
          <span aria-hidden="true" className="mx-2">·</span>
          <span>Photorealistic Lip-Sync & Neural Emotion Architecture</span>
        </div>
        <div className="flex items-center gap-4 text-neutral-400">
          <span>60 FPS Render Pipeline</span>
          <span aria-hidden="true">·</span>
          <span>Web Audio API</span>
          <span aria-hidden="true">·</span>
          <span>Gemini GenAI</span>
        </div>
      </footer>
    </div>
  );
}
