import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

// Plugin to automatically create .nojekyll and 404.html for GitHub Pages static deployments
function githubPagesHelperPlugin() {
  return {
    name: 'github-pages-helper',
    closeBundle() {
      try {
        const distDir = path.resolve(import.meta.dirname || '.', 'dist');
        const indexPath = path.join(distDir, 'index.html');
        const notFoundPath = path.join(distDir, '404.html');
        const nojekyllPath = path.join(distDir, '.nojekyll');

        if (fs.existsSync(indexPath)) {
          // Copy index.html to 404.html for client-side routing fallback
          fs.copyFileSync(indexPath, notFoundPath);
          // Create .nojekyll so GitHub Pages does not run Jekyll processing
          fs.writeFileSync(nojekyllPath, '');
        }
      } catch (err) {
        console.warn('GitHub Pages helper notice:', err);
      }
    },
  };
}

export default defineConfig(({ command }) => {
  // In dev server mode, base must always be '/' for the dev server to route properly
  if (command === 'serve') {
    return {
      base: '/',
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(import.meta.dirname || '.', '.'),
        },
      },
      server: {
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
    };
  }

  // If running in GitHub Actions, GITHUB_REPOSITORY is "owner/photorealistic-Avtar-Teacher"
  const repo = process.env.GITHUB_REPOSITORY
    ? process.env.GITHUB_REPOSITORY.split('/')[1]
    : (process.env.GH_PAGES === 'true' ? 'photorealistic-Avtar-Teacher' : '');

  const base = process.env.BASE_PATH || (repo ? `/${repo}/` : './');

  return {
    base,
    plugins: [react(), tailwindcss(), githubPagesHelperPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
