import { defineConfig } from 'vite'
import path from 'path'
import fs from 'node:fs'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor';
  const repoRoot = path.resolve(__dirname, '..');
  const hasFirebaseNative =
    fs.existsSync(path.join(repoRoot, 'cap-android/app/google-services.json'))
    || fs.existsSync(path.join(repoRoot, 'cap-ios/App/GoogleService-Info.plist'));

  return {
  root: __dirname,
  // Relative asset paths are required for Capacitor's file:// / https://localhost shell.
  base: isCapacitor ? './' : '/',
  define: {
    __CAFYZ_NATIVE_PUSH__: isCapacitor ? hasFirebaseNative : false,
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Native-only Capacitor plugins (not installed in web-v2 for Vercel)
      ...(!isCapacitor
        ? {
            '@kduma-autoid/capacitor-bluetooth-printer': path.resolve(
              __dirname,
              'src/stubs/capacitor-bluetooth-printer.ts',
            ),
          }
        : {}),
    },
  },

  // Dev proxy → backend, so the ported api.ts can use relative /api URLs.
  server: {
    host: true, // 0.0.0.0 — required for Android emulator (10.0.2.2 → host machine)
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
};
});
