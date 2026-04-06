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

## Inline Image (สำคัญ — ห้ามแก้ให้พัง)
ปุ่มลบรูป (✕) แสดงถูกต้องแล้ว ณ commit `bd410bb`:
- **width กำหนดที่ wrap** ไม่ใช่ img → `wrap.style.width = '10%'`, `img.style.width = '100%'`
- wrap ใช้ `display:inline-block; position:relative` — **ห้ามใช้ `overflow:hidden`**
- img ใช้ `display:block` ภายใน wrap
- ปุ่มลบใช้ `position:absolute; top:0; right:0` อยู่ในกรอบรูปทุกขนาด
- Compress รูปด้วย canvas: fill white ก่อน draw เพื่อป้องกัน PNG โปร่งใสกลายเป็นดำ
- **ใช้ `createImageBitmap(file)`** สำหรับ decode รูป — ห้ามใช้ `new Image()` + `onload` เพราะ decode ไม่ทัน ทำให้ภาพขาว (commit `bcf06ef`)

## Layout & Responsive (สำคัญ — ห้ามใช้ zoom)
- **ห้ามใช้ CSS `zoom`** — ทำให้ layout พังใน Brave, Firefox และ browser อื่น
- **Header**: ใช้ `display:flex` โดย search bar ใช้ `flex:1` + icon buttons ใช้ `width:36px; flexShrink:0` — ทำให้ปุ่มไม่ทะลุออกนอกจอทุก browser
- ถ้าต้องการขยายตัวอักษร ให้ปรับ `fontSize` ในแต่ละ component แทน ห้ามใช้ zoom/transform:scale ที่ root
- **ห้ามใช้ spacer div แยกในแต่ละ view** เพื่อเว้นระยะกับปุ่ม FAB — ให้ตั้ง `paddingBottom` ที่ scroll container (parent) จุดเดียว เพราะแต่ละ browser แสดง spacer ไม่เหมือนกัน (เช่น CalendarView body ใช้ `paddingBottom:80`)
- **ห้ามใช้ `scrollIntoView`** ใน nested scroll context — มันจะ scroll parent containers ด้วย ทำให้ Header หายไป ให้ใช้ `scrollTo` บน scroll container ที่ต้องการแทน
