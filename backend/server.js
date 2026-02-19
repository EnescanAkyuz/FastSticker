require('dotenv').config();
const express = require('express');

const app = express();
const port = Number(process.env.PORT || 8787);
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

app.use(express.json({ limit: '25mb' }));

const ALLOWED_STYLES = new Set(['cartoon', 'anime', 'pixel', 'sketch', 'pop', 'emoji']);

const STYLE_PROMPTS = {
  cartoon: 'Convert this portrait into a clean, colorful cartoon sticker style.',
  anime: 'Convert this portrait into anime sticker style with expressive lines.',
  pixel: 'Convert this portrait into retro pixel art sticker style.',
  sketch: 'Convert this portrait into hand-drawn sketch sticker style.',
  pop: 'Convert this portrait into bold pop-art sticker style.',
  emoji: 'Convert this portrait into a playful emoji-like sticker style.',
};

function sanitizeBase64(base64) {
  if (typeof base64 !== 'string') {
    return null;
  }

  const cleaned = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
  if (!cleaned || cleaned.length > 24 * 1024 * 1024) {
    return null;
  }

  return cleaned;
}

function sanitizeMimeType(mimeType) {
  if (typeof mimeType !== 'string') {
    return null;
  }

  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return 'image/jpeg';
  }
  if (normalized === 'image/png') {
    return 'image/png';
  }
  if (normalized === 'image/webp') {
    return 'image/webp';
  }

  return null;
}

function buildPrompt(style, text) {
  const styleInstruction = STYLE_PROMPTS[style] || STYLE_PROMPTS.cartoon;
  const trimmedText = typeof text === 'string' ? text.trim().slice(0, 40) : '';
  const textInstruction = trimmedText
    ? `Add the exact text "${trimmedText}" in readable sticker typography.`
    : 'No extra text unless already in source image.';

  return [
    styleInstruction,
    textInstruction,
    'Keep subject centered, remove noisy background, and return one final transparent-like sticker image.',
    'Do not return explanations, only the generated image.',
  ].join(' ');
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/generate-sticker', async (req, res) => {
  try {
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing on server' });
    }

    const imageBase64 = sanitizeBase64(req.body?.imageBase64);
    const mimeType = sanitizeMimeType(req.body?.mimeType || 'image/jpeg');
    const styleRaw = String(req.body?.style || 'cartoon').toLowerCase();
    const style = ALLOWED_STYLES.has(styleRaw) ? styleRaw : 'cartoon';
    const text = typeof req.body?.text === 'string' ? req.body.text : '';

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Invalid image payload' });
    }

    const prompt = buildPrompt(style, text);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['Image'],
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    const result = await response.json();

    if (!response.ok) {
      const apiError = result?.error?.message || 'Gemini request failed';
      return res.status(response.status).json({ error: apiError });
    }

    const candidate = result?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const imagePart =
      parts.find((part) => part?.inlineData?.data) ||
      parts.find((part) => part?.inline_data?.data);

    const generatedBase64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
    const generatedMimeType =
      imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || 'image/png';

    if (!generatedBase64) {
      return res.status(502).json({ error: 'Gemini did not return an image output' });
    }

    return res.json({
      imageBase64: generatedBase64,
      mimeType: generatedMimeType,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ error: 'Gemini request timed out' });
    }
    console.error('Sticker generation failed', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`StickerExpo backend listening on http://localhost:${port}`);
});
