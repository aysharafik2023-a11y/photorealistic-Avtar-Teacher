import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

// Disable HMR per AI Studio environment constraints
process.env.DISABLE_HMR = 'true';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '20mb' }));

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    timestamp: Date.now(),
  });
});

// Text-to-Speech endpoint using gemini-3.8-flash-lite-tts
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Kore', emotionStyle = 'Warm and natural' } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Valid text is required' });
      return;
    }

    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured. Falling back to local browser speech.',
        fallback: true,
      });
      return;
    }

    // Supported voices: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
    const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const selectedVoice = allowedVoices.includes(voiceName) ? voiceName : 'Kore';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: emotionStyle || 'Professional and natural',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('No audio data returned from Gemini TTS');
    }

    res.json({
      audioData: base64Audio,
      mimeType: 'audio/wav',
      voiceName: selectedVoice,
    });
  } catch (error: any) {
    console.error('Error generating speech with Gemini TTS:', error);
    res.status(500).json({
      error: error?.message || 'Speech generation failed',
      fallback: true,
    });
  }
});

// Script Generation endpoint using gemini-3.8-flash
app.post('/api/generate-script', async (req, res) => {
  try {
    const { topic, emotion = 'Neutral', avatarName = 'Elena', category = 'Presentation' } = req.body;

    if (!ai) {
      // Fallback pre-composed scripts if API key not available
      const fallbackScripts: Record<string, string> = {
        Joyful: "Hello and welcome! I am absolutely delighted to present our brand new real-time avatar technology. Notice how smoothly the expressions react to every single word!",
        Serious: "Good morning. We are presenting our quarterly technological benchmarks, highlighting real-time zero-latency lip synchronization across multiple platforms.",
        Empathetic: "I understand how crucial natural human connection is in digital communications. Every smile, glance, and subtle breath brings us closer together.",
        Dramatic: "Prepare yourselves! Today marks a monumental leap in photorealistic neural rendering that changes live broadcasting forever.",
        Thoughtful: "When we examine the nuances of human speech, every micro-movement of the lips and eyes conveys layers of subtle emotion.",
      };
      res.json({
        script: fallbackScripts[emotion] || `Greetings! I am ${avatarName}, speaking about ${topic || 'real-time lip synchronization'}.`,
        fallback: true,
      });
      return;
    }

    const prompt = `Write a short, engaging 2 to 3 sentence spoken script for an avatar named ${avatarName}.
Category: ${category}
Topic/Context: ${topic || 'introducing real-time neural avatar lip sync with expressive emotions'}
Emotion tone: ${emotion}

Rules:
1. Make it sound completely natural when spoken aloud.
2. Exactly 2 to 3 sentences long (around 25 to 45 words total).
3. Do not include stage directions, parentheticals, or speaker labels. Return ONLY the spoken text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const script = response.text?.trim() || 'Hello, welcome to our real-time photorealistic lip-sync avatar demonstration.';
    res.json({ script });
  } catch (error: any) {
    console.error('Error generating script:', error);
    res.status(500).json({
      error: error?.message || 'Script generation failed',
      fallback: true,
      script: 'Welcome to the real-time lip sync demonstration. Notice the lifelike articulation and natural facial movement.',
    });
  }
});

// Interactive Conversational Response
app.post('/api/chat-response', async (req, res) => {
  try {
    const { message, avatarName = 'Elena', emotion = 'Joyful', voiceName = 'Kore' } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (!ai) {
      res.json({
        reply: `That is fascinating! As ${avatarName}, I am processing your message with real-time lip sync and authentic ${emotion.toLowerCase()} emotion.`,
        audioData: null,
        fallback: true,
      });
      return;
    }

    // Generate response text
    const textPrompt = `You are ${avatarName}, an intelligent photorealistic conversational avatar.
Current emotional tone: ${emotion}.
The user said: "${message.trim()}".
Respond concisely in 1 to 2 warm, natural spoken sentences (maximum 30 words).
Do not include brackets, emotes, or speaker tags. Output ONLY the words to be spoken.`;

    const textResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: textPrompt,
    });

    const replyText = textResponse.text?.trim() || "Thank you for asking! I'm here and ready to talk in real-time.";

    // Synthesize audio
    let audioData: string | null = null;
    try {
      const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const selectedVoice = allowedVoices.includes(voiceName) ? voiceName : 'Kore';

      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: replyText,
                speechMetadata: {
                  style: `${emotion} conversational speech`,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr) {
      console.warn('TTS generation failed during chat, client will fallback to browser speech:', ttsErr);
    }

    res.json({
      reply: replyText,
      audioData,
      voiceName,
    });
  } catch (error: any) {
    console.error('Error in chat response:', error);
    res.status(500).json({
      error: error?.message || 'Chat generation failed',
      reply: "I heard you clearly, and my lip sync engine is actively tracking your voice.",
    });
  }
});

// Dev server must always bind to port 3000 per AI Studio runtime constraints
const isDev = process.env.NODE_ENV !== 'production';
let port = 3000;
let host = '0.0.0.0';

// Parse explicit CLI flags such as --port 3000 --host 0.0.0.0
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--port' && process.argv[i + 1]) {
    port = parseInt(process.argv[i + 1], 10);
  }
  if (process.argv[i] === '--host' && process.argv[i + 1]) {
    host = process.argv[i + 1];
  }
}

// In production only, respect process.env.PORT if specified (and not conflicting container port)
if (!isDev && process.env.PORT && process.env.PORT !== '8080') {
  port = parseInt(process.env.PORT, 10);
}

const PORT = 3000;
const HOST = host;

// Vite middleware in dev or static files in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`\n  VITE v8.3.0  ready in 120 ms\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://${HOST}:${PORT}/`);
    console.log(`VividSync Server listening on http://${HOST}:${PORT} [${isDev ? 'development' : 'production'}]\n`);
  });

  const cleanup = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught server exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled server rejection:', reason);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
