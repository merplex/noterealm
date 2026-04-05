# NoteRealm

PWA cross-platform note-taking & todo app with AI integration.

## Stack
- **Frontend**: React + Vite + Capacitor.js
- **Backend**: Express.js + PostgreSQL (Railway)
- **AI**: Claude / Gemini / ChatGPT (multi-provider)

## Setup

```bash
# Frontend
npm install
npm run dev

# Backend
cd server
npm install
cp .env.example .env  # edit with your credentials
npm run db:migrate
npm run dev
```

## Features
- Google Keep-style masonry note grid
- AI chat blocks (multi-provider)
- Note version history with diff viewer
- Cross-reference between notes
- Todo with priority levels
- Calendar (Year/Month/Week/Day views)
- Integration support (LINE/Email/Telegram/WeChat)
