import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import notesRouter from './routes/notes.js';
import todosRouter from './routes/todos.js';
import aiRouter from './routes/ai.js';
import oauthRouter from './routes/oauth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API Routes
app.use('/api/notes', notesRouter);
app.use('/api/todos', todosRouter);
app.use('/api/ai', aiRouter);
app.use('/api/oauth', oauthRouter);

// Serve frontend static files (production)
const distPath = join(__dirname, '../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`NoteRealm server running on port ${PORT}`);
});
