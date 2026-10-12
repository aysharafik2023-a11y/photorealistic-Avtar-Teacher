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

## GitHub Pages Deployment

To publish this repository to GitHub Pages:

### Method 1: Automatic via GitHub Actions (Recommended)
1. Push this repository to GitHub:
   ```bash
   git push -u origin main
   ```
2. In your GitHub repository (`aysharafik2023-a11y/photorealistic-Avtar-Teacher`):
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) will automatically build and publish the site with relative assets.

### Method 2: Command Line Deploy
```bash
npm run deploy
```
This builds into `dist` and pushes directly to the `gh-pages` branch. In **Settings** > **Pages**, choose deploy from `gh-pages` branch.

## License
MIT
