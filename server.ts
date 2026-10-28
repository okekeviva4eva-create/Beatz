import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  app.post('/api/music/generate', async (req, res) => {
    try {
      const { prompt, model, imageBase64, imageMimeType } = req.body as {
        prompt?: string;
        model?: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
        imageBase64?: string;
        imageMimeType?: string;
      };

      if (!prompt || !prompt.trim()) {
        res.status(400).json({ error: 'Please provide a music prompt.' });
        return;
      }

      const selectedModel =
        model === 'lyria-3-pro-preview' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const contents =
        imageBase64 && imageMimeType
          ? {
              parts: [
                { text: prompt.trim() },
                {
                  inlineData: {
                    data: imageBase64,
                    mimeType: imageMimeType,
                  },
                },
              ],
            }
          : prompt.trim();

      const response = await ai.models.generateContentStream({
        model: selectedModel,
        contents,
        config: {
          responseModalities: [Modality.AUDIO],
        },
      });

      let audioBase64 = '';
      let lyrics = '';
      let mimeType = 'audio/wav';

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;

        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !lyrics) {
            lyrics = part.text;
          }
        }
      }

      if (!audioBase64) {
        res.status(502).json({
          error: 'No audio stream was returned by the model. Ensure a paid Gemini API key is configured in Settings > Secrets.',
        });
        return;
      }

      res.json({
        audioBase64,
        mimeType,
        lyrics,
        model: selectedModel,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to generate music with Lyria. Please check your Gemini API key in Settings > Secrets.';
      console.error('Lyria generation error:', message);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AKAI MPK mini Studio server running on http://localhost:${PORT}`);
  });
}

startServer();
