# TerePay Firebase: Quick Start Guide

**Get up and running in 15 minutes!**

---

## Prerequisites (Already Installed?)

```bash
# Check Node.js
node --version    # Should be 18.0.0+

# Check npm
npm --version     # Should be 9.0.0+

# Check Java
java -version     # Should be 11+

# Check Firebase CLI
firebase --version  # Should be 11.0.0+
```

**If any are missing**, see [FIREBASE_LOCAL_SETUP.md#1-prerequisites](./FIREBASE_LOCAL_SETUP.md#1-prerequisites).

---

## 1. Clone & Install (2 minutes)

```bash
cd ~/Documents
git clone <repo-url>
cd tere-pay-platform

npm install
```

---

## 2. Set Up Environment Variables (2 minutes)

```bash
# Copy template
cp .env.local.example .env.local

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output and paste into ENCRYPTION_KEY in .env.local

# Get Firebase dev credentials from:
# https://console.firebase.google.com → terepay-dev project
# Settings → Web App → Copy config values
```

**Update .env.local**:
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=<from Firebase Console>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=terepay-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=terepay-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=terepay-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from Firebase Console>
NEXT_PUBLIC_FIREBASE_APP_ID=<from Firebase Console>
FIREBASE_ADMIN_SDK_KEY=<path-to-service-account.json>
ENCRYPTION_KEY=<64-char-hex-string>
```

---

## 3. Start Firebase Emulator (1 minute)

```bash
# Terminal 1
npm run firebase:emulate

# Wait for:
# ✔  Firestore Emulator running on http://localhost:8080
# ✔  Authentication Emulator running on http://localhost:9099
# ✔  Firestore Emulator UI running on http://localhost:4000
```

---

## 4. Create Test Users (2 minutes)

Open **http://localhost:4000** (Emulator UI)

1. Click **Authentication** in sidebar
2. Click **Add User**
3. Create two users:

| Email | Password | Role |
|-------|----------|------|
| `applicant@test.com` | `password123` | applicant |
| `lender@test.com` | `password123` | lender |

Set custom claims:
- For applicant: Add claim `role: applicant` 
- For lender: Add claim `role: lender`

---

## 5. Start Next.js Server (1 minute)

```bash
# Terminal 2 (keep Terminal 1 running)
npm run dev

# Wait for: ready on http://localhost:3000
```

---

## 6. Test It Out! (≈7 minutes)

### Login
1. Open http://localhost:3000
2. Click **Login**
3. Enter `applicant@test.com` / `password123`
4. Should see **Applicant Dashboard**

### Switch to Lender
1. Click logout (top right)
2. Login as `lender@test.com` / `password123`
3. Should see **Lender Dashboard**

---

## Common Commands

```bash
# View Firestore data
open http://localhost:4000

# View emulator logs
npm run firebase:emulate

# Reset emulator (clears all data!)
npm run firebase:emulate:clear

# Save emulator data
npm run firebase:export

# Format your code
npm run format

# Check for errors
npm run lint

# Build for production
npm run build
```

---

## Troubleshooting (30 seconds)

**Emulator won't start?**
```bash
# Kill old processes
lsof -i :8080 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
```

**Can't connect to database?**
```bash
# Check emulator is running
curl http://localhost:8080

# Restart everything
# Ctrl+C on both terminals
npm run firebase:emulate     # Terminal 1
npm run dev                  # Terminal 2
```

**Lost test users?**
```bash
# Import saved data
firebase emulators:start --import=./emulator-data
```

---

## Next Steps

- Read [FIREBASE_LOCAL_SETUP.md](./FIREBASE_LOCAL_SETUP.md) for deeper understanding
- Check [PHASE_ONE_CHECKLIST.md](./PHASE_ONE_CHECKLIST.md) for full implementation tasks
- Review [DATA_STRUCTURE.md](./DATA_STRUCTURE.md) before building features

---

## Need Help?

1. **Setup issues?** → [FIREBASE_LOCAL_SETUP.md#12-troubleshooting](./FIREBASE_LOCAL_SETUP.md#12-troubleshooting)
2. **Database questions?** → [DATA_STRUCTURE.md](./DATA_STRUCTURE.md)
3. **Deployment?** → [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**That's it!** You're ready to start developing. 🚀
