# Signed URL Backend (Backblaze B2)

This service creates **signed download URLs** for files stored in a **private** Backblaze B2 bucket.

## Local Setup

1. Create `signing-backend/.env` from `.env.example`.
2. Fill in:
   - `B2_KEY_ID`
   - `B2_APP_KEY`
   - `B2_BUCKET_NAME`
3. Install deps:
   ```bash
   npm install
   ```
4. Run:
   ```bash
   npm start
   ```

Health check: `GET /health`
Signed URL: `GET /sign?file=path/to/file.pdf`
List files: `GET /list`

## Render Deploy (Production)

1. Create a new **Web Service** on Render.
2. Connect your repo.
3. Root directory: `signing-backend`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add Environment Variables:
   - `B2_KEY_ID`
   - `B2_APP_KEY`
   - `B2_BUCKET_NAME`
   - `SIGNED_URL_TTL` (optional)
   - `ALLOWED_PREFIX` (optional)

When Render gives you a URL, test:
`https://<your-render-url>/health`
