import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { checkDbConnection } from './models/db.js';
import notesRouter from './routes/notes.js';
import todosRouter from './routes/todos.js';
import aiRouter from './routes/ai.js';
import oauthRouter from './routes/oauth.js';
import lineRouter from './routes/line.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// เก็บ raw body ไว้สำหรับตรวจ LINE signature
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); },
}));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API Routes
app.use('/api/notes', notesRouter);
app.use('/api/todos', todosRouter);
app.use('/api/ai', aiRouter);
app.use('/api/oauth', oauthRouter);

// LINE Webhook
app.use('/webhook/line', lineRouter);

// Serve frontend static files (production)
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

app.listen(PORT, async () => {
  console.log(`NoteRealm server running on port ${PORT}`);
  const dbOk = await checkDbConnection();
  if (!dbOk) {
    console.error('WARNING: Database is not accessible. Notes will not load. Check DATABASE_URL on Railway.');
  }
});
