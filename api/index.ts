// Vercel runs every file in api/ as a function. This one serves the whole Express app.
// vercel.json rewrites /mcp, /health, /refresh and /chromium-check to it.
import app from '../src/index.js';

export default app;
