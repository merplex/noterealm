import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import notesRouter from './routes/notes.js';
import todosRouter from './routes/todos.js';
import aiRouter from './routes/ai.js';
import oauthRouter from './routes/oauth.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/notes', notesRouter);
app.use('/api/todos', todosRouter);
app.use('/api/ai', aiRouter);
app.use('/api/oauth', oauthRouter);

app.listen(PORT, () => {
  console.log(`NoteKeep server running on port ${PORT}`);
});
