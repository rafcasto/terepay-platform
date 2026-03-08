# TerePay

A secure lending platform connecting borrowers with lenders. Built with Next.js 16, Firebase, and TypeScript.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Running Locally](#running-locally)
- [Available Scripts](#available-scripts)
- [Deploying to Production](#deploying-to-production)

---

## Prerequisites

Ensure the following are installed before getting started:

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Node.js | 18.0.0+ | `node --version` |
| npm | 9.0.0+ | `npm --version` |
| Java | 11+ | `java -version` |
| Firebase CLI | 11.0.0+ | `firebase --version` |

Install the Firebase CLI if needed:

```bash
npm install -g firebase-tools
```

---

## Running Locally

### 1. Clone and install dependencies

```bash
git clone git@github.com:rafcasto/terepay-platform.git
cd terepay-platform
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and fill in the values:

```bash
# Firebase Web App config (from Firebase Console → terepay-dev → Project Settings → Web App)
NEXT_PUBLIC_FIREBASE_API_KEY=<dev-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=terepay-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=terepay-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=terepay-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<dev-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<dev-app-id>

# Firebase Admin SDK (path to service account JSON, or JSON content)
FIREBASE_ADMIN_SDK_KEY=<path-to-service-account.json>

# 32-byte encryption key — generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64-char-hex-string>

# Application
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_API_URL=http://localhost:3000

# Point SDK to local emulators
FIREBASE_EMULATOR_HOST=localhost:8080
```

### 3. Start the Firebase Emulator

In a dedicated terminal, start the emulator suite (Firestore + Auth):

```bash
npm run firebase:emulate
```

Wait until you see:
```
✔  firestore: Firestore Emulator running on localhost:8080
✔  auth: Authentication Emulator running on localhost:9099
✔  ui: Emulator UI running on localhost:4000
```

### 4. Seed test data

With the emulator running, seed a lender account in a second terminal:

```bash
npm run seed:lender
```

This creates a lender user ready to use in the local environment.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The Firebase Emulator UI is available at [http://localhost:4000](http://localhost:4000) to inspect Firestore data and Authentication state.

---

## Refreshing the Local Environment

If you see `auth/network-request-failed` or emulator startup errors like **"port taken"**, a previous emulator process is still holding the ports. Run the following to free them and restart cleanly:

### 1. Kill processes on emulator ports

```bash
lsof -ti tcp:8080 | xargs kill -9 2>/dev/null
lsof -ti tcp:8085 | xargs kill -9 2>/dev/null
lsof -ti tcp:9099 | xargs kill -9 2>/dev/null
```

### 2. Verify ports are free

```bash
lsof -nP -iTCP:8080 -iTCP:8085 -iTCP:9099 | grep LISTEN
# should return nothing
```

### 3. Restart the emulators

```bash
npm run firebase:emulate
```

### 4. Restart the dev server (if needed)

```bash
pkill -f "next dev" 2>/dev/null
npm run dev
```

> **Why this happens:** `NEXT_PUBLIC_ENVIRONMENT=development` always routes Firebase Auth/Firestore calls to the local emulators (`127.0.0.1:9099` / `127.0.0.1:8080`). If those aren't running, every auth call fails with `auth/network-request-failed`.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the app for production |
| `npm start` | Start the production server (after build) |
| `npm run lint` | Run ESLint |
| `npm run firebase:emulate` | Start Firebase Emulator (imports saved data) |
| `npm run firebase:emulate:clear` | Start Firebase Emulator with a clean slate |
| `npm run firebase:export` | Save current emulator data to `emulator-data/` |
| `npm run seed:lender` | Seed a lender account into the running emulator |
| `npm run seed:lender:prod` | Seed a lender account into the **production** Firebase project |

---

## Deploying to Production

The platform uses **Vercel** for hosting and **Firebase** (terepay-prod project) for the backend. Merging a PR into `main` triggers an automatic production deployment.

### 1. Configure Firebase production project

```bash
# Login to Firebase CLI
firebase login

# Deploy Firestore security rules to the production project
firebase deploy --only firestore:rules --project terepay-prod
```

### 2. Set environment variables in Vercel

In the [Vercel Dashboard](https://vercel.com) → Project → Settings → Environment Variables, add the following for the **Production** environment:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=<prod-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=terepay-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=terepay-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=terepay-prod.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<prod-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<prod-app-id>

FIREBASE_ADMIN_SDK_KEY=<prod-service-account.json content>

# Must be different from the development key
ENCRYPTION_KEY=<64-char-hex-string>

NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL=https://terepay.com
NEXT_PUBLIC_ENABLE_LOGGING=false
```

### 3. Connect the repository to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the `terepay-platform` GitHub repository.
2. Vercel auto-detects Next.js — no build configuration changes are needed.
3. Set the **Production Branch** to `main`.

### 4. Deploy

```bash
# Merge to main via a pull request — Vercel deploys automatically.

# Or trigger a manual build from the Vercel dashboard.
```

Every pull request also receives an isolated **Preview Deployment** URL automatically, which serves as the QA/staging environment.

### Branch strategy

| Branch | Environment | Firebase Project |
|--------|------------|-----------------|
| `feature/*` / `bugfix/*` | Vercel Preview (per PR) | terepay-dev |
| `main` | Production | terepay-prod |

### 5. Seed a lender account in production

The public signup endpoint always creates `applicant` accounts. Lender accounts must be seeded manually.

1. Add the following variables to your local `.env.local` (they are only read by the seed script, never sent to Vercel):

```bash
LENDER_EMAIL=lender@yourdomain.com
LENDER_PASSWORD=SomeStr0ngPassword!
LENDER_FIRST_NAME=Jane
LENDER_LAST_NAME=Smith
```

2. Run the production seed script:

```bash
npm run seed:lender:prod
```

This clears the emulator host variables before execution so the Admin SDK connects directly to production Firebase using your `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` credentials.

The script is **idempotent** — if the email already exists it will update the role and Firestore document without creating a duplicate.

> **Note:** Never commit `LENDER_PASSWORD` or service account credentials to the repository.

---

## Further Reading

- [docs/QUICK_START.md](docs/QUICK_START.md) — Detailed local setup walkthrough
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Full deployment and CI/CD reference
- [docs/DATA_STRUCTURE.md](docs/DATA_STRUCTURE.md) — Firestore data model
- [docs/FIREBASE_LOCAL_SETUP.md](docs/FIREBASE_LOCAL_SETUP.md) — Firebase CLI setup guide
