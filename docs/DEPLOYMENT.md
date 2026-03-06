# Deployment Guide - TerePay Platform

## 1. Overview

The TerePay platform supports three deployment environments with corresponding Firebase projects and Vercel deployments. All environments use the same codebase with environment-specific configurations.

---

## 2. Environment Configuration

### 2.1 Environment Levels

| Environment | Branch | Firebase Project | Vercel Env | Purpose | CI/CD |
|-------------|--------|------------------|-----------|---------|-------|
| **Development** | Feature branches | `terepay-dev` | Preview | Local & testing | None |
| **Staging** | `staging` | `terepay-staging` | Staging | QA & validation | Auto-deploy |
| **Production** | `main` | `terepay-prod` | Production | Live platform | Auto-deploy |

### 2.2 Environment Variables

**Local Development (.env.local):**
```bash
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=<dev-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=terepay-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=terepay-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=terepay-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<dev-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<dev-app-id>

# Firebase Admin SDK (Server-side)
FIREBASE_ADMIN_SDK_KEY=<path-to-dev-service-account.json>

# Application Settings
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_LOGGING=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=true

# Feature Flags (Dev defaults)
NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE=true

# Firebase Emulator
FIREBASE_EMULATOR_HOST=localhost:8080
```

**Staging (.env.staging):**
```bash
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=<staging-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=terepay-staging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=terepay-staging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=terepay-staging.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<staging-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<staging-app-id>

# Firebase Admin SDK
FIREBASE_ADMIN_SDK_KEY=<path-to-staging-service-account.json>

# Application Settings
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_API_URL=https://staging.terepay.vercel.app
NEXT_PUBLIC_ENABLE_LOGGING=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=false

# Sentry Setup
SENTRY_AUTH_TOKEN=<staging-token>

# Feature Flags
NEXT_PUBLIC_FEATURE_FLAGS_OVERRIDE=false
```

**Production (.env.production):**
```bash
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=<prod-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=terepay-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=terepay-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=terepay-prod.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<prod-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<prod-app-id>

# Firebase Admin SDK
FIREBASE_ADMIN_SDK_KEY=<path-to-prod-service-account.json>

# Application Settings
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL=https://terepay.com
NEXT_PUBLIC_ENABLE_LOGGING=false
NEXT_PUBLIC_ENABLE_MOCK_DATA=false

# Sentry Setup
SENTRY_AUTH_TOKEN=<prod-token>

# Security
SECURE_AUTH_COOKIE=true
AUTH_COOKIE_SECURE=true
```

---

## 3. Local Development Setup

### 3.1 Prerequisites
- Node.js 18+ and npm
- Firebase CLI installed globally
- Git configured with GitHub SSH key

### 3.2 Initial Setup

```bash
# 1. Clone the repository
git clone git@github.com:rafcasto/terepay-platform.git
cd terepay-platform

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.local.example .env.local

# 4. Update .env.local with Firebase dev credentials
# (Get from Firebase Console → terepay-dev project)

# 5. Start Firebase Emulator (optional, for offline development)
npm run firebase:emulate

# 6. In another terminal, start the development server
npm run dev

# 7. Open http://localhost:3000
```

### 3.3 Development Commands

```bash
# Start Next.js dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Start Firebase Emulator Suite
npm run firebase:emulate

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

---

## 4. GitHub Configuration

### 4.1 Repository Setup

```bash
# Initialize git repository
git init
git add remote origin git@github.com:rafcasto/terepay-platform.git

# Create branches
git checkout -b develop
git checkout -b staging
git checkout main
```

### 4.2 Branch Strategy

**Main Branches:**
- `main` - Production ready, protected, requires PR review
- `staging` - QA environment, requires PR from develop
- `develop` - Integration branch, default branch

**Feature Branches:**
- `feature/loan-application` - Feature development
- `bugfix/auth-issue` - Bug fixes
- `hotfix/security-patch` - Production hotfixes

### 4.3 GitHub Secrets (Required for CI/CD)

Set these in GitHub Repository Settings → Secrets:

```
FIREBASE_ADMIN_SDK_DEV=<dev-service-account.json content>
FIREBASE_ADMIN_SDK_STAGING=<staging-service-account.json content>
FIREBASE_ADMIN_SDK_PROD=<prod-service-account.json content>

VERCEL_TOKEN=<vercel-api-token>
VERCEL_ORG_ID=<vercel-org-id>
VERCEL_PROJECT_ID=<vercel-project-id>

SENTRY_AUTH_TOKEN=<sentry-token>
```

---

## 5. Firebase Setup

### 5.1 Firebase Projects

Create three Firebase projects:

1. **terepay-dev** (Development)
   - Firestore database
   - Authentication (Email/Password, Google)
   - Cloud Storage for documents
   - Cloud Functions (for scheduled tasks)

2. **terepay-staging** (Staging)
   - Same setup as production for testing
   - Less strict security rules for testing
   - Smaller data retention

3. **terepay-prod** (Production)
   - Firestore database with backups enabled
   - Authentication with production settings
   - Cloud Storage with lifecycle policies
   - Cloud Functions for critical operations
   - Firestore security rules enforced

### 5.2 Initialize Firebase Projects

```bash
# Login to Firebase
firebase login

# Initialize Firebase locally
firebase init

# When prompted:
# - Select "Firestore", "Storage", "Functions"
# - Choose project: terepay-dev (for local testing)
# - Accept defaults unless noted
```

### 5.3 Firestore Security Rules

**Development (Relaxed for Testing):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all read/write in development
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Production (Strict):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users - own data only
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
      allow read: if isAdmin();
    }
    
    // Loan Applications
    match /loanApplications/{docId} {
      allow read, write: if isApplicantOwner(docId);
      allow read: if isAssignedLender(docId);
      allow read: if isAdmin();
    }
    
    // Loans
    match /loans/{docId} {
      allow read: if isApplicantOrLender(docId);
      allow write: if isAdmin();
    }
    
    // Feature Flags
    match /featureFlags/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Audit Logs
    match /auditLogs/{docId} {
      allow read: if request.auth.uid == resource.data.userId;
      allow read: if isAdmin();
      allow create: if request.auth != null;
    }
  }
  
  function isAdmin() {
    return get(/databases/$(database)/documents/users/$(request.auth.uid))
      .data.role == 'admin';
  }
  
  function isApplicantOwner(docId) {
    return request.auth.uid == get(/databases/$(database)/documents/loanApplications/$(docId)).data.applicantId;
  }
  
  function isAssignedLender(docId) {
    return request.auth.uid == get(/databases/$(database)/documents/loanApplications/$(docId)).data.lenderId;
  }
  
  function isApplicantOrLender(docId) {
    let loan = get(/databases/$(database)/documents/loans/$(docId)).data;
    return request.auth.uid == loan.applicantId || request.auth.uid == loan.lenderId;
  }
}
```

### 5.4 Deploy Firestore Rules

```bash
# Deploy to dev
firebase deploy --only firestore:rules --project terepay-dev

# Deploy to staging
firebase deploy --only firestore:rules --project terepay-staging

# Deploy to production
firebase deploy --only firestore:rules --project terepay-prod
```

---

## 6. Vercel Deployment

### 6.1 Vercel Project Setup

1. **Connect Repository:**
   - Go to https://vercel.com/dashboard
   - Click "New Project"
   - Import `rafcasto/terepay-platform` repository
   - Configure as Next.js project

2. **Environment Variables:**
   - Set in Vercel Project Settings → Environment Variables
   - Different variables for each environment (Preview/Staging/Production)

3. **Production Settings:**
   - Preview: Auto-deploy from pull requests
   - Staging: Auto-deploy from `staging` branch
   - Production: Auto-deploy from `main` branch with approval

### 6.2 Deployment Configuration (vercel.json)

```json
{
  "buildCommand": "npm run build",
  "env": {
    "NEXT_PUBLIC_FIREBASE_API_KEY": "@next_public_firebase_api_key",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN": "@next_public_firebase_auth_domain",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID": "@next_public_firebase_project_id",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": "@next_public_firebase_storage_bucket",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "@next_public_firebase_messaging_sender_id",
    "NEXT_PUBLIC_FIREBASE_APP_ID": "@next_public_firebase_app_id",
    "NEXT_PUBLIC_ENVIRONMENT": "@next_public_environment",
    "FIREBASE_ADMIN_SDK_KEY": "@firebase_admin_sdk_key"
  },
  "headers": [
    {
      "source": "/api/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/docs",
      "destination": "/docs/index.html"
    }
  ]
}
```

### 6.3 Deploy Commands

```bash
# Deploy to Vercel (production)
npm run deploy:prod

# Deploy to staging
npm run deploy:staging

# Deploy preview from feature branch
# (Automatic on pull request)
```

---

## 7. GitHub Actions CI/CD Pipeline

### 7.1 Workflow Files

**`.github/workflows/deploy-staging.yml`**
```yaml
name: Deploy to Staging

on:
  push:
    branches: [staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm run test
      
      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel Staging
        uses: vercel/action@main
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          alias: staging
        env:
          NEXT_PUBLIC_ENVIRONMENT: staging
          FIREBASE_ADMIN_SDK_KEY: ${{ secrets.FIREBASE_ADMIN_SDK_STAGING }}
      
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Staging deployment successful ✅"
            }
```

**`.github/workflows/deploy-production.yml`**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm run test:coverage
      - name: Lint
        run: npm run lint
      - name: Build
        run: npm run build

  security-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run security audit
        run: npm audit --production

  deploy:
    needs: [test, security-check]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel Production
        uses: vercel/action@main
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
        env:
          NEXT_PUBLIC_ENVIRONMENT: production
          FIREBASE_ADMIN_SDK_KEY: ${{ secrets.FIREBASE_ADMIN_SDK_PROD }}
      
      - name: Create Sentry Release
        uses: getsentry/action-release@v1
        with:
          environment: production
          sentry-auth-token: ${{ secrets.SENTRY_AUTH_TOKEN }}
      
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🚀 Production deployment successful!"
            }
```

---

## 8. Monitoring & Observability

### 8.1 Sentry Error Tracking

```javascript
// sentry.client.config.js
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filter out certain errors
    if (event.exception) {
      const error = event.exception.values[0];
      if (error.value?.includes("NetworkError")) {
        return null;
      }
    }
    return event;
  }
});
```

### 8.2 Vercel Analytics

- **Web Vitals Monitoring** - Automatically enabled
- **Performance Monitoring** - Via Vercel Analytics dashboard
- **Error Tracking** - Via Vercel Integrations

### 8.3 Firebase Monitoring

Dashboard available in:
- **Firebase Console** → Performance
- **Firebase Console** → Realtime Database Performance
- **Google Cloud Console** → Monitoring

---

## 9. Rollback Procedures

### 9.1 Vercel Rollback

```bash
# View deployment history
vercel list --project terepay-platform

# Rollback to previous deployment
vercel rollback <deployment-id>

# Or via Vercel Dashboard → Deployments → Rollback button
```

### 9.2 Firebase Rollback

```bash
# View Firestore backups in Google Cloud Console
gcloud firestore backups list

# Restore from backup
gcloud firestore restore <backup-id> <location>
```

### 9.3 Database Rollback

If data was corrupted:
1. Restore from Firestore backup
2. Verify data integrity
3. Re-deploy application code

---

## 10. Disaster Recovery

### 10.1 Backup Strategy

- **Code**: GitHub (automatic 90-day retention)
- **Database**: Firestore automated daily backups (30-day retention)
- **Storage**: Cloud Storage with lifecycle policies
- **Secrets**: GitHub secrets, encrypted locally

### 10.2 Recovery Time Objectives

| Component | RTO | RPO |
|-----------|-----|-----|
| Application Code | 15 min | 0 min |
| Database | 1 hour | 24 hours |
| Storage Objects | 4 hours | 24 hours |

---

## 11. Checklist Before Launch

- [ ] Firebase projects created and configured
- [ ] Firestore security rules deployed
- [ ] Environment variables set in Vercel
- [ ] GitHub secrets configured
- [ ] CI/CD workflows tested
- [ ] Staging deployment successful
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Backup procedures verified
- [ ] Monitoring and alerting enabled
- [ ] Documentation updated
- [ ] Team trained on deployment process

