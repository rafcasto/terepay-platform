# Firebase Local Environment Setup - Phase One

## Overview

This guide provides complete instructions for setting up Firebase locally for TerePay platform development. The setup uses Firebase Emulator Suite to simulate Firestore, Authentication, and Cloud Functions in a local environment, enabling offline development and rapid iteration without affecting production data.

---

## 1. Prerequisites

### Required Software

- **Node.js** 18.0.0+ and npm 9.0.0+
  ```bash
  node --version  # Should be v18.0.0 or higher
  npm --version   # Should be 9.0.0 or higher
  ```

- **Firebase CLI** 11.0.0+
  ```bash
  npm install -g firebase-tools
  firebase --version
  ```

- **Java Runtime Environment (JRE)** 11+
  - Required for Firebase Emulator Suite
  - Download from [java.com](https://www.java.com) or install via homebrew:
    ```bash
    brew install openjdk@11
    ```

### System Requirements

- Minimum 4GB RAM (8GB+ recommended)
- At least 2GB free disk space
- macOS 10.15+, Linux (Ubuntu 18+), or Windows 10+

---

## 2. Installation & Initial Setup

### 2.1 Firebase CLI Setup

```bash
# Install Firebase CLI globally
npm install -g firebase-tools@latest

# Verify installation
firebase --version

# Authenticate with your Google account
firebase login

# If you already logged in, list your projects to verify
firebase projects:list
```

### 2.2 Project Configuration

```bash
# In the project root directory, initialize Firebase
firebase init

# During initialization, select:
# ✓ Firestore
# ✓ Authentication  
# ✓ Emulators (select Firestore, Auth, and Pub/Sub)
# ✓ Do NOT use hosting for now

# This creates firebase.json and .firebaserc (if not already present)
```

### 2.3 Verify firebase.json Configuration

Your `firebase.json` should include emulator configuration:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": {
      "host": "localhost",
      "port": 9099
    },
    "firestore": {
      "host": "localhost",
      "port": 8080
    },
    "pubsub": {
      "host": "localhost",
      "port": 8085
    },
    "ui": {
      "enabled": true,
      "host": "localhost",
      "port": 4000
    }
  }
}
```

---

## 3. Firebase Emulator Setup

### 3.1 Starting the Emulator

```bash
# Start Firebase Emulator Suite (runs all emulators)
firebase emulators:start

# Expected output:
# ✔  Firestore Emulator running on http://localhost:8080
# ✔  Authentication Emulator running on http://localhost:9099
# ✔  Pub/Sub Emulator running on http://localhost:8085
# ✔  Firestore Emulator UI running on http://localhost:4000
```

### 3.2 Emulator UI Access

- **Firestore UI**: http://localhost:4000
  - View and manage collections
  - Execute queries
  - Export/import data
  - View real-time updates

- **Authentication UI**: Within Firestore UI at http://localhost:4000
  - Create test users
  - View user accounts
  - Edit custom claims

### 3.3 Port Configuration

If ports are already in use, configure different ports in `firebase.json`:

```json
{
  "emulators": {
    "auth": {
      "host": "localhost",
      "port": 9099
    },
    "firestore": {
      "host": "localhost",
      "port": 8080
    },
    "pubsub": {
      "host": "localhost",
      "port": 8085
    },
    "ui": {
      "host": "localhost",
      "port": 4000
    }
  }
}
```

Update environment variables accordingly (see Section 4).

---

## 4. Environment Configuration

### 4.1 Create .env.local File

Create a `.env.local` file in the project root with Firebase development credentials:

```bash
# Firebase Configuration (Development)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDxXnXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=terepay-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=terepay-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=terepay-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abe123456789def

# Firebase Admin SDK Configuration
FIREBASE_ADMIN_SDK_KEY=<path-to-service-account.json>

# Encryption Key (for PII encryption)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64-character-hex-string>

# Local Development Settings
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_LOGGING=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=false

# Firebase Emulator Settings
FIREBASE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

### 4.2 Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# This outputs a 64-character hex string
# Copy and paste into ENCRYPTION_KEY in .env.local
```

### 4.3 Get Firebase Dev Credentials

From [Firebase Console](https://console.firebase.google.com):
1. Select `terepay-dev` project
2. Go to Project Settings (gear icon)
3. Under "Your apps", select the web app
4. Copy the Firebase configuration and set environment variables

---

## 5. Firebase Security Rules for Local Development

### 5.1 Firestore Security Rules

Create or update `firestore.rules` for development (permissive for testing):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Development: Allow all reads and writes for authenticated users
    match /{document=**} {
      allow read, write: if request.auth != null;
    }

    // Unauthenticated access for testing
    match /public/{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 5.2 Apply Rules to Emulator

```bash
# Deploy rules to emulator (automatically happens with emulators:start)
firebase emulators:start

# Manually update:
firebase deploy --only firestore:rules
```

### 5.3 Production Rules (Reference)

These rules will be deployed to production later:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isLender(userId) {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'lender';
    }

    function isApplicant(userId) {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'applicant';
    }

    // Users collection
    match /users/{userId} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
      allow read: if isLender(request.auth.uid);
    }

    // Loan Applications
    match /loanApplications/{docId} {
      allow read, write: if isApplicant(request.auth.uid);
      allow read: if isLender(request.auth.uid);
    }

    // Loans (lender-only read)
    match /loans/{docId} {
      allow read: if isLender(request.auth.uid);
    }

    // Payments
    match /payments/{docId} {
      allow read, write: if isAuthenticated();
    }

    // Feature Flags
    match /featureFlags/{docId} {
      allow read: if isAuthenticated();
      allow write: if isLender(request.auth.uid);
    }
  }
}
```

---

## 6. Firebase Authentication Setup

### 6.1 Enable Authentication Methods

In Firebase Console (terepay-dev project):
1. Go to **Authentication** → **Sign-in method**
2. Enable:
   - **Email/Password**
   - **Google** (optional for development)

### 6.2 Create Test Users

#### Via Emulator UI

1. Open http://localhost:4000
2. Click **Authentication** in the left sidebar
3. Click **Add User**
4. Enter email and password:
   - **Applicant Test**: `applicant@test.com` / `password123`
   - **Lender Test**: `lender@test.com` / `password123`

#### Via Firebase CLI

```bash
# Interactive user creation
firebase auth:import users.json --hash-algo=bcrypt --rounds=10

# Or create programmatically via API
```

### 6.3 Set Custom Claims (User Roles)

Custom claims are set server-side to define user roles. Update user roles via the Emulator UI or programmatically:

```typescript
// src/server/firebase-admin.ts
import * as admin from 'firebase-admin';

async function setUserRole(uid: string, role: 'applicant' | 'lender') {
  await admin.auth().setCustomUserClaims(uid, { role });
  console.log(`Set custom claims for user ${uid}: role=${role}`);
}

// Usage in API routes
```

---

## 7. Firestore Database Initialization

### 7.1 Initialize Collections

Create minimal collections for testing. You can do this via the Firestore Emulator UI or programmatically:

```typescript
// src/server/init-firestore.ts
import * as admin from 'firebase-admin';

export async function initializeFirestore() {
  const db = admin.firestore();

  // Create test user
  const testUser = {
    id: 'user-test-001',
    email: 'applicant@test.com',
    role: 'applicant',
    fullName: 'Test Applicant',
    createdAt: admin.firestore.Timestamp.now(),
  };

  await db.collection('users').doc(testUser.id).set(testUser);

  // Create test feature flags
  const flags = {
    enableLoanApplications: { enabled: true, rolloutPercentage: 100 },
    enablePayments: { enabled: false, rolloutPercentage: 0 },
  };

  for (const [name, config] of Object.entries(flags)) {
    await db.collection('featureFlags').doc(name).set(config);
  }

  console.log('✓ Firestore initialized with test data');
}
```

### 7.2 Sample Collections Structure

```
Firestore (terepay-dev)
├── users/
│   └── user-test-001
│       ├── email: "applicant@test.com"
│       ├── role: "applicant"
│       └── createdAt: timestamp
│
├── loanApplications/
│   └── app-test-001
│       ├── applicantId: "user-test-001"
│       ├── amount: 1000
│       └── status: "pending"
│
├── loans/
│   └── loan-test-001
│       ├── applicationId: "app-test-001"
│       ├── lenderId: "lender-001"
│       └── status: "active"
│
└── featureFlags/
    └── enableLoanApplications
        ├── enabled: true
        └── rolloutPercentage: 100
```

---

## 8. Development Workflow

### 8.1 Starting Development

```bash
# Terminal 1: Start Firebase Emulator
npm run firebase:emulate

# Terminal 2: Start Next.js dev server
npm run dev

# Open http://localhost:3000
```

### 8.2 Testing Connected Services

```bash
# Check Firestore connection
curl -X GET http://localhost:8080/v1/projects/terepay-dev/databases/(default)/documents/users

# Check Authentication
firebase auth:get applicant@test.com

# View Emulator UI
open http://localhost:4000
```

### 8.3 Accessing Emulator Data in Code

Next.js automatically detects emulator environment variables:

```typescript
// src/server/db.ts
import * as admin from 'firebase-admin';

const serviceAccount = require(process.env.FIREBASE_ADMIN_SDK_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

// Emulator detection is automatic via environment variables
export const db = admin.firestore();
export const auth = admin.auth();
```

---

## 9. Data Persistence & Export

### 9.1 Enable Data Persistence

By default, the emulator creates temporary data. To persist data between sessions:

```bash
# Start emulator with export on exit
firebase emulators:start --export-on-exit=./emulator-data

# Next time, data will be loaded from ./emulator-data
firebase emulators:start --import=./emulator-data
```

### 9.2 Export/Import Data

```bash
# Export current emulator data
firebase emulators:export ./backup-$(date +%s)

# Import data into emulator
firebase emulators:start --import=./backup-1234567890 --export-on-exit

# Clear emulator data completely
firebase emulators:start --clear-on-exit
```

### 9.3 Add Export to .gitignore

```gitignore
# Firebase emulator data
emulator-data/
firestore-debug.log
ui-debug.log
```

---

## 10. Integration with Next.js

### 10.1 Client-Side Firebase Initialization

```typescript
// src/lib/firebase-client.ts
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// Connect to emulator in development
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENVIRONMENT === 'development') {
  // Check if emulator is already connected
  if (!auth.emulatorConfig) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  }

  if (!firestore._settings.host || !firestore._settings.host.includes('localhost')) {
    connectFirestoreEmulator(firestore, 'localhost', 8080);
  }
}

export default app;
```

### 10.2 Server-Side Firebase Admin Initialization

```typescript
// src/server/firebase-admin.ts
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

if (!admin.apps.length) {
  let serviceAccount;

  try {
    const keyPath = process.env.FIREBASE_ADMIN_SDK_KEY;
    if (keyPath && keyPath.endsWith('.json')) {
      serviceAccount = JSON.parse(readFileSync(resolve(keyPath), 'utf-8'));
    } else {
      // Fallback for environment variable with JSON content
      serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY || '{}');
    }
  } catch (error) {
    console.error('Failed to load Firebase service account:', error);
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth };
```

---

## 11. NPM Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "firebase:emulate": "firebase emulators:start --import=./emulator-data",
    "firebase:emulate:clear": "firebase emulators:start --clear-on-exit",
    "firebase:export": "firebase emulators:export ./emulator-data-$(date +%s)",
    "firebase:init": "firebase init",
    "firebase:deploy:rules": "firebase deploy --only firestore:rules",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write src"
  }
}
```

---

## 12. Troubleshooting

### Issue: Emulator Won't Start

**Cause**: Port already in use or Java not installed

**Solution**:
```bash
# Kill processes on ports
lsof -i :8080  # Firestore
lsof -i :9099  # Auth
lsof -i :4000  # UI

# Replace 8080 with actual port, then:
kill -9 <PID>

# Or configure different ports in firebase.json
```

### Issue: "Cannot find module 'firebase-admin'"

**Cause**: Dependencies not installed

**Solution**:
```bash
npm install firebase-admin firebase
```

### Issue: Custom Claims Not Applied

**Cause**: Claims not set on user, or wrong field name

**Solution**:
```bash
# Set custom claims via admin SDK
firebase auth:set-custom-claims <uid> --claims '{"role":"lender"}'

# Or via Firebase CLI (if available)
```

### Issue: Firestore Emulator Accepts Connections But No Data

**Cause**: Connected to remote Firestore instead of emulator

**Solution**:
```bash
# Verify environment variables
echo $FIREBASE_EMULATOR_HOST  # Should be localhost:8080

# Check connectFirestoreEmulator() is called in client code
# Check emulator is running: curl http://localhost:8080
```

### Issue: Error "emulator not running" in tests

**Cause**: Tests run before emulator starts

**Solution**:
```bash
# Ensure emulator starts before tests
firebase emulators:start &
sleep 5
npm test
```

---

## 13. Next Steps (Phase One Checklist)

- [ ] Set up Firebase CLI (`firebase login`)
- [ ] Create `.env.local` with development Firebase credentials
- [ ] Run `firebase emulators:start`
- [ ] Create test users in Authentication
- [ ] Set up Firestore collections with sample data
- [ ] Test SDK connection from Next.js
- [ ] Create API route to verify authentication
- [ ] Set up mock data for applicant dashboard
- [ ] Configure security rules for development
- [ ] Document database schema in [DATA_STRUCTURE.md](./DATA_STRUCTURE.md)
- [ ] Create initial test suite for Firebase integration

---

## 14. Additional Resources

- [Firebase Emulator Suite Documentation](https://firebase.google.com/docs/emulator-suite)
- [Firestore Security Rules Guide](https://firebase.google.com/docs/firestore/security/start)
- [Firebase Admin SDK (Node.js)](https://firebase.google.com/docs/admin/setup)
- [Firebase Web SDK Documentation](https://firebase.google.com/docs/web/setup)
- [TerePay DEPLOYMENT.md](./DEPLOYMENT.md) - Full deployment guide

---

## 15. Firebase Configuration Reference

### 15.1 Development Firebase Project Details

```
Project Name: terepay-dev
Project ID: terepay-dev
Region: us-central1
Billing: Firebase Free Tier (sufficient for development)
```

### 15.2 Required Firebase Services

- Firestore Database
- Authentication (Email/Password, Google Sign-In)
- Cloud Storage (for document uploads, optional for phase 1)
- Cloud Messaging (optional for phase 1)

### 15.3 Firestore Database Rules Deployment

Development rules are temporarily permissive. Before moving to production:

1. Update rules with proper role-based access control
2. Set up document-level security
3. Validate rules with sample data
4. Deploy via CI/CD pipeline

See [Section 5.3](#53-production-rules-reference) for production rules.

---

**Last Updated**: March 8, 2026  
**Phase**: Phase One - Local Development Setup  
**Status**: Complete
