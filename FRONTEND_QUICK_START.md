# Frontend Quick Start Card

## 🎯 Start the App (Pick One)

### Option 1: Automatic (Windows)
```powershell
# Just double-click this file:
start-dev.bat
```
✅ Opens browser automatically
✅ Starts both frontend & backend
✅ Everything in one click

### Option 2: Manual (Windows/Mac/Linux)

**Terminal 1 - Start Frontend:**
```bash
cd frontend
npm run dev
```
→ Opens at `http://localhost:5173`

**Terminal 2 - Start Backend:**
```bash
cd backend
mvn spring-boot:run
```
→ Runs at `http://localhost:8080`

## 📋 What You Get

| What | URL | Purpose |
|------|-----|---------|
| **App** | http://localhost:5173 | Upload videos, see results |
| **API** | http://localhost:8080 | Backend referee decision engine |
| **Health** | http://localhost:8080/api/health | Check backend status |

## ⚡ While Running

| Action | Command |
|--------|---------|
| Type-check code | `npm run typecheck` |
| Run tests | `npm test` |
| Build for production | `npm run build` |
| Watch tests | `npm run test:watch` |

## 🔧 Key Files

```
frontend/
├── src/App.tsx          ← Main app component
├── vite.config.ts       ← Dev server config
├── package.json         ← Dependencies
└── tsconfig.json        ← TypeScript config
```

## 🌍 Environment Variables

**`VITE_API_BASE_URL`** - Leave blank (default) for local dev

The Vite proxy automatically forwards `/api` calls to `localhost:8080`

## ✅ Prerequisites

- ✅ Node.js v18+ installed
- ✅ npm dependencies installed (already done)
- ✅ Java 17+ for backend
- ✅ Maven for backend

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 5173 taken | Vite auto-selects next port (5174, etc.) |
| Backend not found | Run `cd backend && mvn spring-boot:run` |
| Hot reload not working | Hard refresh: `Ctrl+Shift+R` |
| TypeScript errors | Run `npm run typecheck` |
| Module not found | Run `npm install` again |

## 📖 Documentation

- **Full Setup Guide:** `FRONTEND_SETUP.md`
- **Setup Status:** `FRONTEND_READY.md`
- **Project README:** `README.md`

## 🎬 Typical Workflow

1. Start frontend: `npm run dev`
2. Start backend: `mvn spring-boot:run`
3. Open `http://localhost:5173`
4. Edit files in `frontend/src/`
5. Watch browser auto-reload
6. Upload videos to test

## 🏃 Just Run This!

**Windows:**
```powershell
start-dev.bat
```

**Mac/Linux:**
```bash
./start-dev.sh
```

**Or Manually:**
```bash
cd frontend && npm run dev
```

---

**That's it! App runs at `http://localhost:5173` 🚀**
