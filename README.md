# AI Studio Talking Avatar & Keynote Video Generator

A high-fidelity interactive talking avatar and video generator with studio lighting, realistic viseme mouth synchronization, natural micro-blinking, and locked stationary studio framing.

## Features

- **Stationary Studio Framing**: Eliminates unwanted background shift, shake, or camera sway while speaking. All motion is strictly isolated to realistic anatomical lip-sync and expressive eye articulation.
- **Micro-Blinking & Natural Eye Articulation**: Dynamic facial mesh landmark alignment with natural skin-tone matched eyelids and pupil focus.
- **Audio Viseme Engine**: Real-time multi-frequency audio analysis mapping phonemes and visemes to mouth opening, spread, and vermilion contours.
- **Multiple Studio Personalities**: Preloaded with high-definition presenter profiles (Elena Vance, Marcus Vance, Sofia Chen, David Ross) and custom portrait photo upload.
- **Studio Audio & Speech**: Multi-voice TTS preview, custom script teleprompter, microphone input, and instant video recorder.
- **Production Ready**: Optimized asset bundling with Vite and production-ready Express server.

## Getting Started

### Prerequisites
- Node.js 18+
- npm or bun

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
The application will be running on `http://localhost:3000`.

### Production Build & Run
```bash
npm run build
npm start
```

## Environment Variables
Copy `.env.example` to `.env` and fill in your Gemini API key if utilizing generative scripts:
```bash
GEMINI_API_KEY=your_gemini_api_key
```

## License
MIT
