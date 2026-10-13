import React, { useState, useEffect } from 'react';
import { Send, Sparkles, MessageSquare, Volume2 } from 'lucide-react';
import { AvatarProfile } from '../types/avatar';
import { EmotionPresetKey } from '../types/emotion';
import { AudioVisemeAnalyzer } from '../utils/audioAnalyzer';

interface ChatAssistantProps {
  avatar: AvatarProfile;
  currentEmotion: EmotionPresetKey;
  audioAnalyzer: AudioVisemeAnalyzer;
  onSpeakingChange: (speaking: boolean) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'avatar';
  text: string;
  timestamp: string;
}

const SAMPLE_QUESTIONS = [
  'How does your real-time lip sync engine work?',
  'Give me a 20-second motivational thought.',
  'Tell me a witty joke with expressive timing.',
  'What emotions can you express right now?',
];

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  avatar,
  currentEmotion,
  audioAnalyzer,
  onSpeakingChange,
}) => {
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'avatar',
      text: `Hello! I am ${avatar.name}. Ask me anything, and I will reply with real-time lip sync and authentic ${currentEmotion.toLowerCase()} emotion!`,
      timestamp: 'Just now',
    },
  ]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      audioAnalyzer.stopSyntheticSpeech();
    };
  }, [audioAnalyzer]);

  const handleSendMessage = async (userText: string) => {
    const textToSend = userText.trim();
    if (!textToSend || isLoading) return;

    await audioAnalyzer.resumeContext();

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          avatarName: avatar.name,
          emotion: currentEmotion,
          voiceName: avatar.defaultVoice || 'Kore',
        }),
      });

      let replyText = "Hello! I am listening and ready to present.";
      let audioData: string | null = null;

      if (res.ok) {
        const data = await res.json();
        replyText = data.reply || "I'm processing that right now!";
        audioData = data.audioData || null;
      } else {
        replyText = `Thank you for sharing that! As ${avatar.name}, I'm demonstrating real-time lip synchronization with natural blinking and stable portrait framing.`;
      }

      const avatarMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'avatar',
        text: replyText,
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, avatarMsg]);

      // Play synthesized audio
      if (audioData) {
        const binaryString = atob(audioData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const audioCtx = audioAnalyzer.getContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);

        onSpeakingChange(true);
        audioAnalyzer.playAudioBuffer(audioBuffer, () => {
          onSpeakingChange(false);
          audioAnalyzer.resetVisemes();
        });
      } else {
        // Fallback Web Speech API with real-time synthetic viseme driver
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(replyText);
          utterance.pitch = avatar.gender === 'female' ? 1.1 : 0.95;

          utterance.onboundary = (e) => {
            if (e.name === 'word' && e.charIndex !== undefined) {
              const word = replyText.slice(e.charIndex).split(/\s+/)[0];
              audioAnalyzer.updateSpeechWord(word);
            }
          };

          utterance.onstart = () => {
            onSpeakingChange(true);
            audioAnalyzer.startSyntheticSpeech(replyText);
          };

          utterance.onend = () => {
            onSpeakingChange(false);
            audioAnalyzer.stopSyntheticSpeech();
          };

          utterance.onerror = () => {
            onSpeakingChange(false);
            audioAnalyzer.stopSyntheticSpeech();
          };

          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4 flex flex-col h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Interactive Real-Time Conversation</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Converse directly with {avatar.name} &middot; AI reasoning & speech
          </p>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-neutral-800 text-white rounded-tr-none'
                  : 'bg-neutral-950 border border-neutral-800/80 text-neutral-200 rounded-tl-none'
              }`}
            >
              <div className="text-[10px] text-neutral-500 mb-1 font-medium">
                {msg.sender === 'user' ? 'You' : avatar.name}
              </div>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl rounded-tl-none px-3.5 py-2.5 text-neutral-400 flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
              <span>{avatar.name} is thinking & synthesizing speech...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="space-y-1.5 pt-2 border-t border-neutral-800">
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSendMessage(q)}
              disabled={isLoading}
              className="text-[11px] px-2.5 py-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded-md transition-colors cursor-pointer text-left truncate max-w-[280px]"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2 pt-1">
          <input
            type="text"
            placeholder={`Message ${avatar.name}...`}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputMessage)}
            disabled={isLoading}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
          />
          <button
            onClick={() => handleSendMessage(inputMessage)}
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
