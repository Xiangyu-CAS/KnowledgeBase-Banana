import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const registerKnowledgeBaseSaver = (middlewares: any, rootDir: string) => {
  middlewares.use('/api/knowledge-base/save', async (req: any, res: any, next: any) => {
    if (req.method !== 'POST') return next();

    const chunks: Uint8Array[] = [];
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        const payload = JSON.parse(raw || '{}');
        const name: string = (payload.name || '').trim();
        const base64: string = payload.base64 || '';
        const mimeType: string = payload.mimeType || 'image/png';

        if (!name || !base64) {
          res.statusCode = 400;
          res.end('Missing name or base64 payload');
          return;
        }

        const kbDir = path.join(rootDir, 'KnowledgeBase');
        const manifestPath = path.join(kbDir, 'index.json');
        await fs.promises.mkdir(kbDir, { recursive: true });

        const safeName = name.replace(/[\\/:*?"<>|]/g, '_');
        const extension = mimeType.split('/')[1]?.split('+')[0] || 'png';
        const filename = `${safeName}.${extension}`;
        const filePath = path.join(kbDir, filename);

        await fs.promises.writeFile(filePath, Buffer.from(base64, 'base64'));

        let manifest: { characters: Array<{ name: string; path: string }> } = { characters: [] };
        try {
          const existing = await fs.promises.readFile(manifestPath, 'utf-8');
          manifest = JSON.parse(existing);
        } catch (e) {
          manifest = { characters: [] };
        }

        const entry = { name, path: `KnowledgeBase/${filename}` };
        const idx = manifest.characters.findIndex(c => c.name === name);
        if (idx >= 0) {
          manifest.characters[idx] = entry;
        } else {
          manifest.characters.push(entry);
        }

        await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify(entry));
      } catch (error) {
        console.error('[KnowledgeBase Saver] Failed to persist asset', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  });
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const rootDir = __dirname;
  return {
    server: {
      port: 3000,
      host: '0.0.0.0'
    },
    plugins: [
      react(),
      {
        name: 'knowledge-base-saver',
        configureServer(server) {
          registerKnowledgeBaseSaver(server.middlewares, rootDir);
        },
        configurePreviewServer(server) {
          registerKnowledgeBaseSaver(server.middlewares, rootDir);
        }
      }
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    }
  };
});
