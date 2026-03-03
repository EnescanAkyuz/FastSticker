require('dotenv').config();
const express = require('express');
const { Jimp, intToRGBA, rgbaToInt, JimpMime } = require('jimp');

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
    'Keep only the main subject and remove all background.',
    'Output must be a PNG sticker with true transparent background (alpha=0 outside subject).',
    'No scene, no backdrop, no colored background, no shadow plate.',
    'Do not return explanations, only one generated image.',
  ].join(' ');
}

function getEdgeColorSamples(image) {
  const { width, height } = image.bitmap;
  const samplePoints = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];

  return samplePoints.map(([x, y]) => intToRGBA(image.getPixelColor(x, y)));
}

function estimateBackground(samples) {
  let r = 0;
  let g = 0;
  let b = 0;
  let weightTotal = 0;

  for (const sample of samples) {
    const weight = Math.max(1, sample.a);
    r += sample.r * weight;
    g += sample.g * weight;
    b += sample.b * weight;
    weightTotal += weight;
  }

  return {
    r: Math.round(r / weightTotal),
    g: Math.round(g / weightTotal),
    b: Math.round(b / weightTotal),
  };
}

function colorDistanceSquared(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

async function cutBackgroundFromEdges(base64Image) {
  const input = Buffer.from(base64Image, 'base64');
  const image = await Jimp.read(input);
  const { width, height } = image.bitmap;

  if (width < 2 || height < 2) {
    return null;
  }

  const samples = getEdgeColorSamples(image);
  const bg = estimateBackground(samples);

  // Adaptive threshold: tighter for flat backgrounds, looser for noisy ones.
  const maxSampleDist = samples.reduce(
    (max, sample) => Math.max(max, colorDistanceSquared(sample, bg)),
    0
  );
  const threshold = Math.max(36, Math.min(82, Math.sqrt(maxSampleDist) + 18));
  const thresholdSquared = threshold * threshold;

  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    const rgba = intToRGBA(image.getPixelColor(x, y));

    const isAlreadyTransparent = rgba.a <= 6;
    const isLikelyBackground = colorDistanceSquared(rgba, bg) <= thresholdSquared;
    if (!isAlreadyTransparent && !isLikelyBackground) {
      continue;
    }

    if (rgba.a !== 0) {
      image.setPixelColor(rgbaToInt(rgba.r, rgba.g, rgba.b, 0), x, y);
    }

    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  const output = await image.getBuffer(JimpMime.png);
  return {
    imageBase64: output.toString('base64'),
    mimeType: 'image/png',
  };
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

    let finalImageBase64 = generatedBase64;
    let finalMimeType = generatedMimeType;

    try {
      const cutResult = await cutBackgroundFromEdges(generatedBase64);
      if (cutResult?.imageBase64) {
        finalImageBase64 = cutResult.imageBase64;
        finalMimeType = cutResult.mimeType;
      }
    } catch (cutError) {
      console.warn('Background cut skipped:', cutError?.message || cutError);
    }

    return res.json({
      imageBase64: finalImageBase64,
      mimeType: finalMimeType,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ error: 'Gemini request timed out' });
    }
    console.error('Sticker generation failed', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`StickerExpo backend listening on http://localhost:${port}`);
  });
}

module.exports = app;
