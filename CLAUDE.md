# NoteRealm — Project Context

## Project Structure
```
noterealm/
├── src/              ← Frontend (React + Vite + Capacitor)
├── server/           ← Backend (Express.js) — deploy บน Railway
│   ├── package.json  ← มี script แยกจาก root
│   ├── index.js
│   ├── routes/
│   ├── providers/    ← AI provider plugins
│   └── models/
│       ├── db.js
│       └── migrate.js
├── package.json      ← Frontend package.json
└── capacitor.config.json
```

**สำคัญ**: โปรเจคนี้มี **2 package.json** — root (frontend) กับ server/ (backend)

## Backend on Railway
- **URL**: `https://noterealm-production.up.railway.app`
- **Root Directory** on Railway: `server`
- **PostgreSQL**: `postgresql://postgres:dRtBNgcnILPcMXNNaUsrHaOjCBIQsRFT@caboose.proxy.rlwy.net:57998/railway`

## Run Database Migration (จาก local)
```bash
cd server
DATABASE_URL="postgresql://postgres:dRtBNgcnILPcMXNNaUsrHaOjCBIQsRFT@caboose.proxy.rlwy.net:57998/railway" npm run db:migrate
```
ต้อง `cd server` ก่อน เพราะ `db:migrate` script อยู่ใน `server/package.json`

## Install backend dependencies (ถ้ายังไม่ได้ทำ)
```bash
cd server
npm install
```

## Environment Variables (Railway)
| Variable | Value | Description |
|---|---|---|
| `DATABASE_URL` | (auto from Railway PostgreSQL) | PostgreSQL connection |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude AI — server-side key |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Google OAuth for Gemini |
| `GOOGLE_CLIENT_SECRET` | `xxx` | Google OAuth secret |
| `SERVER_URL` | `https://noterealm-production.up.railway.app` | Backend URL |

## Frontend Environment
สร้าง `.env` ที่ root:
```
VITE_API_URL=https://noterealm-production.up.railway.app
```

## AI Providers (Plugin-based)
- **Claude** (authType: server) — ใช้ ANTHROPIC_API_KEY ฝั่ง server
- **Gemini** (authType: oauth) — user กด Sign in with Google
- เพิ่ม AI ใหม่: สร้าง `server/providers/xxx.js` + เพิ่มใน `src/constants/providers.js`

## Git Workflow (สำคัญมาก)
ทุกครั้งที่ commit + push feature branch **ต้อง merge เข้า main แล้ว push main ด้วยเสมอ** เพื่อให้ Railway deploy อัตโนมัติ ห้ามถามซ้ำ ทำเลย:
```bash
git checkout main && git merge <feature-branch> && git push origin main && git checkout <feature-branch>
```

## ชื่อแอป
ชื่อคือ **NoteRealm** (ไม่ใช่ NoteKeep)
