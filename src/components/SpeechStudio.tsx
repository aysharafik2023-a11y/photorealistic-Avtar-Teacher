import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Sparkles, Volume2, Upload, FileAudio } from 'lucide-react';
import { AvatarProfile } from '../types/avatar';
import { EmotionPresetKey, EMOTION_PRESETS } from '../types/emotion';
import { AudioVisemeAnalyzer } from '../utils/audioAnalyzer';

interface SpeechStudioProps {
  avatar: AvatarProfile;
  currentEmotion: EmotionPresetKey;
  audioAnalyzer: AudioVisemeAnalyzer;
  onSpeakingChange: (speaking: boolean) => void;
}

const TEMPLATE_SCRIPTS = [
  {
    title: 'Product Launch',
    text: 'Welcome everyone! Today we are introducing our breakthrough real-time avatar synthesis pipeline. Watch how precisely each word synchronizes with authentic emotional nuance.',
  },
  {
    title: 'News Broadcast',
    text: 'Good evening. Across the technology sector today, researchers unveiled zero-latency neural speech synchronization, enabling instant lifelike broadcasts across global networks.',
  },
  {
    title: 'Empathetic Connection',
    text: 'I know how demanding modern workflows can feel. Remember that taking a deep breath and sharing a genuine smile can change the entire course of your day.',
  },
  {
    title: 'Dramatic Keynote',
    text: 'This is not merely an incremental update. We have dissolved the boundary between synthetic avatars and authentic human presence forever.',
  },
];

const VOICES = [
  { id: 'Kore', name: 'Kore', gender: 'Female', tone: 'Clear, balanced, studio announcer' },
  { id: 'Puck', name: 'Puck', gender: 'Male', tone: 'Bright, energetic, broadcaster' },
  { id: 'Charon', name: 'Charon', gender: 'Male', tone: 'Deep, resonant, executive' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male', tone: 'Authoritative, firm, direct' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female', tone: 'Gentle, warm, conversational' },
];

export const SpeechStudio: React.FC<SpeechStudioProps> = ({
  avatar,
  currentEmotion,
  audioAnalyzer,
  onSpeakingChange,
}) => {
  const [scriptText, setScriptText] = useState<string>(TEMPLATE_SCRIPTS[0].text);
  const [selectedVoice, setSelectedVoice] = useState<string>(avatar.defaultVoice || 'Kore');
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [topicPrompt, setTopicPrompt] = useState<string>('');
  const [showPromptInput, setShowPromptInput] = useState<boolean>(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop playback when component unmounts
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const stopPlayback = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    audioAnalyzer.stopSyntheticSpeech();

    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch {}
      activeSourceRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    audioAnalyzer.disconnect();
    setIsPlaying(false);
    onSpeakingChange(false);
  };

  // Generate Script via Gemini
  const handleGenerateScript = async () => {
    setIsGeneratingScript(true);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicPrompt.trim() || undefined,
          emotion: currentEmotion,
          avatarName: avatar.name,
          category: 'Keynote & Presentation',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.script) {
          setScriptText(data.script);
          setShowPromptInput(false);
          setTopicPrompt('');
          return;
        }
      }

      // Offline / Static preset scripts when backend is unavailable
      const offlineScripts: Record<string, string> = {
        Neutral: "Good morning and welcome to our presentation. Today we explore real-time avatar synthesis with locked studio framing and natural articulation.",
        Happy: "I'm delighted to welcome you to VividSync! Real-time lip synchronization and expressive communication have never looked better.",
        Empathetic: "Thank you for joining me today. Meaningful communication starts with active listening, clear expression, and mutual understanding.",
        Professional: "Welcome to today's executive overview. We maintain strict standards for visual stability, articulate delivery, and acoustic clarity.",
        Excited: "This is remarkable! We have completely eliminated background jitter while preserving fluid speech and natural micro-blinking!",
        Serious: "Attention to detail is imperative. Every phoneme and viseme transition is calculated with high mathematical precision.",
      };
      setScriptText(offlineScripts[currentEmotion] || offlineScripts.Neutral);
      setShowPromptInput(false);
      setTopicPrompt('');
    } catch (err) {
      console.warn('Backend script generation unavailable, using offline template:', err);
      setScriptText("Welcome to VividSync Studio! Experience high-fidelity photorealistic avatars with stationary framing and real-time lip sync.");
      setShowPromptInput(false);
      setTopicPrompt('');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Synthesize Speech and Play
  const handlePlaySpeech = async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (!scriptText.trim()) return;

    await audioAnalyzer.resumeContext();
    setIsSynthesizing(true);
    try {
      const emotionDesc = EMOTION_PRESETS[currentEmotion]?.promptDescription || 'Natural tone';

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scriptText,
          voiceName: selectedVoice,
          emotionStyle: `${emotionDesc} matching ${currentEmotion} emotion`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioData) {
          // Decode base64 WAV returned by Gemini TTS
          const binaryString = atob(data.audioData);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const audioCtx = audioAnalyzer.getContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);

          setIsSynthesizing(false);
          setIsPlaying(true);
          onSpeakingChange(true);

          const source = audioAnalyzer.playAudioBuffer(audioBuffer, () => {
            setIsPlaying(false);
            onSpeakingChange(false);
            audioAnalyzer.resetVisemes();
          });
          activeSourceRef.current = source;
          return;
        }
      }

      // If backend TTS is unavailable (e.g. GitHub Pages static deployment), use browser speech
      fallbackBrowserSpeech();
    } catch (err) {
      console.warn('Backend TTS unavailable on static host, using browser speech synthesis:', err);
      fallbackBrowserSpeech();
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Browser Web Speech fallback with natural synchronized mouth articulation
  const fallbackBrowserSpeech = () => {
    if (!('speechSynthesis' in window)) {
      console.warn('[VividSync Speech] Speech synthesis is not supported on this browser.');
      setIsSynthesizing(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(scriptText);
    utterance.rate = 1.0;
    utterance.pitch = avatar.gender === 'female' ? 1.15 : 0.95;

    // Track spoken words to guide phonetic mouth shapes
    utterance.onboundary = (e) => {
      if (e.name === 'word' && e.charIndex !== undefined) {
        const word = scriptText.slice(e.charIndex).split(/\s+/)[0];
        audioAnalyzer.updateSpeechWord(word);
      }
    };

    utterance.onstart = () => {
      setIsPlaying(true);
      onSpeakingChange(true);
      // Drive biological phonetic visemes in real-time
      audioAnalyzer.startSyntheticSpeech(scriptText);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      onSpeakingChange(false);
      audioAnalyzer.stopSyntheticSpeech();
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      onSpeakingChange(false);
      audioAnalyzer.stopSyntheticSpeech();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Upload custom audio file (MP3 / WAV)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    stopPlayback();
    await audioAnalyzer.resumeContext();

    const url = URL.createObjectURL(file);
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio();
    }
    const audio = audioElementRef.current;
    audio.src = url;
    audio.onended = () => {
      setIsPlaying(false);
      onSpeakingChange(false);
      audioAnalyzer.resetVisemes();
    };

    audioAnalyzer.connectAudioElement(audio);
    audio.play().then(() => {
      setIsPlaying(true);
      onSpeakingChange(true);
    }).catch((err) => console.error('Audio play error:', err));
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Neural Voice Synthesis & Script Studio
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Deliver customizable speeches with 24kHz studio vocal timbre
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPromptInput(!showPromptInput)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 bg-sky-950/40 border border-sky-900/60 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Script</span>
          </button>
        </div>
      </div>

      {/* AI Prompt Input Bar (Expandable) */}
      {showPromptInput && (
        <div className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-lg space-y-2.5">
          <div className="text-xs font-medium text-neutral-300">Prompt Gemini to Write Speech</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Introduce a new eco-friendly autonomous vehicle..."
              value={topicPrompt}
              onChange={(e) => setTopicPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateScript()}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleGenerateScript}
              disabled={isGeneratingScript}
              className="px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isGeneratingScript ? 'Writing...' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Template Chips */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-neutral-400">Sample Templates</label>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_SCRIPTS.map((tpl) => (
            <button
              key={tpl.title}
              onClick={() => {
                setScriptText(tpl.text);
                setUploadFileName(null);
              }}
              className="px-2.5 py-1 text-xs font-medium bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded-md transition-colors cursor-pointer"
            >
              {tpl.title}
            </button>
          ))}
        </div>
      </div>

      {/* Script Textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <label className="font-medium">Avatar Spoken Script</label>
          <span className="font-mono tabular-nums text-neutral-500">
            {scriptText.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
        <textarea
          rows={3}
          value={scriptText}
          onChange={(e) => {
            setScriptText(e.target.value);
            setUploadFileName(null);
          }}
          placeholder="Enter any text you want your avatar to speak..."
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 leading-relaxed resize-none"
        />
      </div>

      {/* Voice Selection & Audio Upload */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-800/80">
        {/* Prebuilt Voice Picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-400">Gemini Neural Voice</label>
          <div className="grid grid-cols-2 gap-1.5">
            {VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVoice(v.id)}
                className={`p-2 text-left rounded-lg border transition-all cursor-pointer ${
                  selectedVoice === v.id
                    ? 'bg-neutral-800 border-neutral-600 text-white'
                    : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-medium flex items-center justify-between">
                  <span>{v.name}</span>
                  <span className="text-[10px] text-neutral-500">{v.gender}</span>
                </div>
                <div className="text-[10px] text-neutral-500 truncate mt-0.5">{v.tone}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Audio File Upload */}
        <div className="space-y-1.5 flex flex-col justify-between">
          <div>
            <label className="text-xs font-medium text-neutral-400">Or Sync With Audio File</label>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Upload any pre-recorded WAV or MP3 speech file
            </p>
          </div>

          <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <FileAudio className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className="text-xs text-neutral-300 truncate">
                {uploadFileName || 'No audio file selected'}
              </span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors cursor-pointer shrink-0"
            >
              <Upload className="w-3 h-3" />
              <span>Upload</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handlePlaySpeech}
              disabled={isSynthesizing || (!scriptText.trim() && !uploadFileName)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-sm ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              } disabled:opacity-50`}
            >
              {isSynthesizing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Synthesizing Voice...</span>
                </>
              ) : isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause Playback</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Synthesize & Speak</span>
                </>
              )}
            </button>

            {isPlaying && (
              <button
                onClick={stopPlayback}
                className="p-2.5 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
                title="Stop playback"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
