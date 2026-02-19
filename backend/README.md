# StickerExpo Backend

## Setup

1. Install dependencies:
   - `npm --prefix backend install`
2. Create `backend/.env` from `backend/.env.example` and set:
   - `GEMINI_API_KEY=...`
   - `PORT=8787` (optional)
3. Start the backend:
   - `npm run backend:dev`

## API

- `GET /health`
- `POST /api/generate-sticker`
  - Body:
    - `imageBase64` (required)
    - `mimeType` (`image/jpeg|image/png|image/webp`)
    - `style` (`cartoon|anime|pixel|sketch|pop|emoji`)
    - `text` (optional)
