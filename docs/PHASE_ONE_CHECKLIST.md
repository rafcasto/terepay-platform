# Phase One Implementation Checklist

**Project**: TerePay Platform  
**Phase**: Phase One - MVP Foundation  
**Date**: March 8, 2026  
**Status**: In Progress

---

## Overview

Phase One focuses on establishing the foundational infrastructure for the TerePay platform. This includes local development environment setup, Firebase configuration, basic authentication, and initial UI structure for applicant and lender interfaces.

---

## 1. Firebase Local Development Environment

### 1.1 Firebase Installation & Configuration
- [ ] Install Node.js 18+ and npm 9+
- [ ] Install Firebase CLI globally: `npm install -g firebase-tools`
- [ ] Install Java Runtime Environment (JRE) 11+
- [ ] Authenticate Firebase CLI: `firebase login`
- [ ] Verify Firebase projects: `firebase projects:list`
- [ ] Initialize Firebase in project: `firebase init`
- [ ] Verify `firebase.json` configuration with proper emulator settings
- [ ] **Document**: Refer to [FIREBASE_LOCAL_SETUP.md](./FIREBASE_LOCAL_SETUP.md)

### 1.2 Environment Variables
- [ ] Create `.env.local` file in project root
- [ ] Add Firebase development credentials (get from Firebase Console)
- [ ] Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Set `ENCRYPTION_KEY` environment variable
- [ ] Set `FIREBASE_ADMIN_SDK_KEY` path or content
- [ ] Document all required environment variables
- [ ] Add `.env.local` to `.gitignore` (never commit)

### 1.3 Firebase Emulator Suite
- [ ] Start Emulator: `npm run firebase:emulate`
- [ ] Verify Firestore running on `http://localhost:8080`
- [ ] Verify Authentication running on `http://localhost:9099`
- [ ] Verify Emulator UI accessible on `http://localhost:4000`
- [ ] Configure data persistence: `--import=./emulator-data`
- [ ] Test Emulator UI (create collections, view data)

### 1.4 Firebase Authentication Setup
- [ ] Enable Email/Password authentication in Firebase Console
- [ ] Enable Google Sign-In (optional for phase 1)
- [ ] Create test users in Emulator UI:
  - [ ] Applicant user: `applicant@test.com` / `password123`
  - [ ] Lender user: `lender@test.com` / `password123`
- [ ] Set custom claims for test users (role: 'applicant' or 'lender')
- [ ] Test authentication flow locally

### 1.5 Firestore Database Setup
- [ ] Review [DATA_STRUCTURE.md](./DATA_STRUCTURE.md) for schema
- [ ] Create initial collections in Emulator:
  - [ ] `users`
  - [ ] `loanApplications`
  - [ ] `loans`
  - [ ] `payments`
  - [ ] `featureFlags`
- [ ] Add sample documents for testing
- [ ] Verify collections visible in Emulator UI
- [ ] Test write permissions with test users

---

## 2. Project Setup & Dependencies

### 2.1 Code Repository
- [ ] Clone repository
- [ ] Checkout `main` branch
- [ ] Verify `.git` is configured
- [ ] Set up GitHub SSH key (if not already done)
- [ ] Confirm remote: `git remote -v` → `origin` should point to terepay-platform

### 2.2 Node.js Dependencies
- [ ] Run `npm install`
- [ ] Verify all dependencies installed
- [ ] Check for security vulnerabilities: `npm audit`
- [ ] Review `package.json` for existing scripts
- [ ] Add Firebase-related scripts (if missing):
  - `firebase:emulate`
  - `firebase:emulate:clear`
  - `firebase:export`
  - `firebase:init`

### 2.3 Core Dependencies (verify installed)
- [ ] `next` (Next.js framework)
- [ ] `react` & `react-dom`
- [ ] `typescript`
- [ ] `firebase` (client SDK)
- [ ] `firebase-admin` (server SDK)
- [ ] `react-hook-form` (form management)
- [ ] `zod` (validation)
- [ ] `tailwindcss` (styling)
- [ ] Optional: `@vercel/flags` (feature flags)

---

## 3. Firebase Integration with Next.js

### 3.1 Client-Side Setup (`src/lib/firebase-client.ts`)
- [ ] Create Firebase client initialization file
- [ ] Initialize Firebase app with credentials
- [ ] Initialize `getAuth()` and `getFirestore()`
- [ ] Connect to emulator in development:
  - [ ] `connectAuthEmulator()`
  - [ ] `connectFirestoreEmulator()`
- [ ] Export `auth` and `firestore` instances
- [ ] Test client connection with simple write operation

### 3.2 Server-Side Setup (`src/server/firebase-admin.ts`)
- [ ] Create Firebase Admin SDK initialization file
- [ ] Load service account from environment
- [ ] Initialize `admin.initializeApp()`
- [ ] Export `db` and `auth` instances
- [ ] Verify no duplicate app initialization
- [ ] Test server connection with simple read operation

### 3.3 Type Definitions
- [ ] Create TypeScript interfaces for Firestore documents
- [ ] Define types for:
  - `User` (users collection)
  - `LoanApplication` (loanApplications collection)
  - `Loan` (loans collection)
  - `Payment` (payments collection)
  - `FeatureFlag` (featureFlags collection)
- [ ] Store types in `src/types/firestore.ts`
- [ ] Document nullable fields and constraints

---

## 4. Authentication Setup

### 4.1 Authentication API Routes
- [ ] Create `/api/auth/login` route
  - [ ] Accept email/password
  - [ ] Validate with Firebase Auth
  - [ ] Exchange ID token for session cookie
  - [ ] Return `idToken` to client
- [ ] Create `/api/auth/signup` route
  - [ ] Validate input with Zod
  - [ ] Create Firebase user
  - [ ] Create user document in Firestore
  - [ ] Handle initial role assignment
- [ ] Create `/api/auth/logout` route
  - [ ] Clear session cookies
  - [ ] Revoke tokens if applicable
- [ ] Create `/api/auth/session` route (optional)
  - [ ] Return current user session

### 4.2 Authentication Middleware
- [ ] Create authentication middleware for API routes
  - [ ] Verify Firebase ID token
  - [ ] Check user existence in Firestore
  - [ ] Attach user info to request context
- [ ] Create role-based authorization helper
  - [ ] Check user role from custom claims
  - [ ] Support role checks in API routes (Lender, Applicant)

### 4.3 Session Management
- [ ] Implement secure HTTP-only cookies for session
- [ ] Configure cookie settings:
  - [ ] Secure: `true` (HTTPS only)
  - [ ] HttpOnly: `true` (no JavaScript access)
  - [ ] SameSite: `Strict` or `Lax`
  - [ ] MaxAge: 7 days (configurable)
- [ ] Create session validation utility
- [ ] Test session persistence across requests

### 4.4 Client-Side Auth State
- [ ] Create `useAuth()` hook
  - [ ] Track authentication state
  - [ ] Expose login/logout functions
  - [ ] Expose current user info
  - [ ] Handle loading state
- [ ] Create protected route wrapper
  - [ ] Redirect unauthenticated users to login
  - [ ] Support role-based route protection
- [ ] Test authentication flow end-to-end

---

## 5. User Interface - Basic Structure

### 5.1 Authentication Pages
- [ ] `/auth/login` page
  - [ ] Email/password form
  - [ ] Form validation with React Hook Form
  - [ ] Submit to `/api/auth/login`
  - [ ] Redirect to dashboard on success
  - [ ] Display error messages
- [ ] `/auth/signup` page
  - [ ] User registration form
  - [ ] Role selection (Applicant/Lender)
  - [ ] Form validation
  - [ ] Submit to `/api/auth/signup`
  - [ ] Redirect to login or dashboard
- [ ] 404/error pages for auth failures

### 5.2 Applicant Interface
- [ ] `/applicant/dashboard` page
  - [ ] Welcome message with user name
  - [ ] List of user's loan applications
  - [ ] Quick links to key actions
- [ ] `/applicant/apply` page (form structure only)
  - [ ] Basic form layout
  - [ ] Not functional in phase 1
- [ ] `/applicant/applications` page
  - [ ] List user's submitted applications
  - [ ] Status badges
  - [ ] Link to application details
- [ ] `/applicant/profile` page
  - [ ] Display user profile information
  - [ ] Basic profile editing (optional)

### 5.3 Lender Interface
- [ ] `/lender/dashboard` page
  - [ ] Welcome message
  - [ ] Summary statistics (placeholders for phase 1)
  - [ ] Navigation to applications view
- [ ] `/lender/applications` page
  - [ ] List all applications (read-only)
  - [ ] Filter by status
  - [ ] Link to application details
- [ ] `/lender/applications/[id]` page
  - [ ] Display application details
  - [ ] Action buttons (placeholders for phase 1)
- [ ] `/lender/portfolio` page (optional for phase 1)
  - [ ] Placeholder for active loans view
- [ ] `/lender/profile` page
  - [ ] Lender profile information

### 5.4 Layout Components
- [ ] Root layout (`src/app/layout.tsx`)
  - [ ] Global styles with Tailwind
  - [ ] Navigation header (login-aware)
  - [ ] Footer
- [ ] Authentication layout
  - [ ] Centered form layout
  - [ ] Branding/logo
- [ ] Applicant layout wrapper
  - [ ] Sidebar/navigation menu
  - [ ] User menu
- [ ] Lender layout wrapper
  - [ ] Sidebar/navigation menu
  - [ ] User menu

### 5.5 Reusable Components
- [ ] Form components
  - [ ] `<TextInput />` with validation errors
  - [ ] `<Select />` for dropdowns
  - [ ] `<Button />` with loading state
- [ ] Data display components
  - [ ] `<Card />` for content sections
  - [ ] `<Table />` or `<List />` for data
  - [ ] `<Badge />` for status indicators
  - [ ] `<Skeleton />` for loading states
- [ ] Common utilities
  - [ ] `<NavBar />` component
  - [ ] `<UserMenu />` dropdown
  - [ ] `<ProtectedRoute />` wrapper

---

## 6. Database & Security Rules

### 6.1 Firestore Security Rules
- [ ] Create `firestore.rules` file with development rules
  - [ ] Allow authenticated users to read all documents
  - [ ] Allow users to modify only their own documents
  - [ ] Allow lenders to read applications
  - [ ] Deny writes to unauthenticated users
- [ ] Deploy rules to emulator
- [ ] Test rules with different user roles
- [ ] Document production security requirements

### 6.2 Firestore Indexes
- [ ] Create basic indexes for common queries
  - [ ] Users by email
  - [ ] Applications by applicant ID
  - [ ] Applications by status
  - [ ] Loans by lender ID
- [ ] Document index requirements in [DATA_STRUCTURE.md](./DATA_STRUCTURE.md)

---

## 7. API Routes (Core)

### 7.1 Application API Endpoints
- [ ] `GET /api/applications` - List all applications (lender only)
- [ ] `GET /api/applications/[id]` - Get application details
- [ ] `GET /api/applications/user` - Get user's applications (applicant only)
- [ ] `POST /api/applications` - Create application (applicant only)
- [ ] Basic validation and error handling for all routes

### 7.2 User API Endpoints
- [ ] `GET /api/users/profile` - Get current user profile
- [ ] `POST /api/users/profile` - Update user profile
- [ ] `GET /api/users/[id]` - Get user details (lender only for applicants)

### 7.3 Error Handling
- [ ] Consistent error response format
- [ ] Proper HTTP status codes (200, 400, 401, 403, 404, 500)
- [ ] Input validation on all endpoints
- [ ] Rate limiting (optional for phase 1, reference [DEPLOYMENT.md](./DEPLOYMENT.md))

---

## 8. Testing & Validation

### 8.1 Manual Testing
- [ ] Test user registration flow
  - [ ] Create new user as applicant
  - [ ] Create new user as lender
  - [ ] Verify user data saved in Firestore
- [ ] Test login flow
  - [ ] Login with correct credentials
  - [ ] Session persists across page refreshes
  - [ ] Logout clears session
- [ ] Test role-based access
  - [ ] Applicant see applicant pages, not lender
  - [ ] Lender can see applications list
  - [ ] Unauthenticated users redirected to login
- [ ] Test API endpoints
  - [ ] Create application via API
  - [ ] Retrieve user's application list
  - [ ] Authorization checks work

### 8.2 Integration Testing (optional for phase 1)
- [ ] Create test fixtures for users
- [ ] Create test fixtures for applications
- [ ] Test authentication flow end-to-end
- [ ] Test API endpoints with different user roles

### 8.3 Documentation
- [ ] Document all API endpoints (request/response formats)
- [ ] Create example cURL requests for testing
- [ ] Document expected error responses
- [ ] Add API documentation to docs folder (optional)

---

## 9. Development Environment & Tooling

### 9.1 Code Quality
- [ ] Set up ESLint with TypeScript support
- [ ] Set up Prettier for code formatting
- [ ] Create `.eslintrc.json` configuration
- [ ] Create `.prettierrc` configuration
- [ ] Add scripts to `package.json`:
  - `npm run lint`
  - `npm run format`
  - `npm run lint:fix`

### 9.2 Git Configuration
- [ ] Create `.gitignore` file
  - [ ] Node modules: `node_modules/`
  - [ ] Environment: `.env.local`
  - [ ] Build outputs: `.next/`, `out/`
  - [ ] Logs: `*.log`
  - [ ] Emulator data: `emulator-data/`
  - [ ] IDE: `.vscode/`, `.idea/`
- [ ] Create `.gitattributes` (optional)
- [ ] Make initial commit with project structure

### 9.3 Development Scripts
- [ ] Verify all scripts in `package.json` work:
  - `npm run dev` - Start Next.js dev server
  - `npm run build` - Build for production
  - `npm run firebase:emulate` - Start Firebase Emulator
  - `npm run lint` - Lint code
  - `npm run format` - Format code
- [ ] Create convenient shortcuts
  - Optional: `npm run dev:full` (runs both emulator and dev server)

---

## 10. Documentation Updates

### 10.1 Firebase Setup Documentation
- [x] Create [FIREBASE_LOCAL_SETUP.md](./FIREBASE_LOCAL_SETUP.md)
  - [x] Complete installation guide
  - [x] Emulator configuration
  - [x] Environment variables
  - [x] Security rules (dev & prod)
  - [x] Test user setup
  - [x] Troubleshooting

### 10.2 Update Existing Documentation
- [ ] Update [README.md](./README.md) with quick start link to Firebase setup
- [ ] Add phase 1 checklist to [PLATFORM_PLAN.md](./PLATFORM_PLAN.md) (reference this checklist)
- [ ] Update [DEPLOYMENT.md](./DEPLOYMENT.md) with local setup reference

### 10.3 Create Developer Guide (optional)
- [ ] Document development workflow
- [ ] Create troubleshooting guide
- [ ] Document common tasks (create test data, reset emulator, etc.)

---

## 11. Project Initialization Checklist

### 11.1 Before Starting Development
- [ ] Clone repository
- [ ] Copy `.env.local.example` to `.env.local` (update credentials)
- [ ] Run `npm install`
- [ ] Run `firebase login`
- [ ] Start with `npm run firebase:emulate` (Terminal 1)
- [ ] Start with `npm run dev` (Terminal 2)
- [ ] Open `http://localhost:3000`

### 11.2 Verify Setup
- [ ] Firestore Emulator running (Health check: `curl http://localhost:8080`)
- [ ] Auth Emulator running (UI at `http://localhost:4000`)
- [ ] Next.js dev server running (http://localhost:3000)
- [ ] Test user in Emulator (applicant@test.com)
- [ ] Can log in with test user
- [ ] Can view dashboard after login

---

## 12. Phase One Deliverables Summary

### What's Included
✅ Firebase local development environment  
✅ Authentication (signup/login/logout)  
✅ User roles (Applicant/Lender)  
✅ Basic Firestore integration  
✅ Security rules for local development  
✅ Applicant dashboard (basic UI)  
✅ Lender dashboard (basic UI)  
✅ API routes for core operations  
✅ Comprehensive documentation  

### What's NOT Included (Later Phases)
⚪ Loan application workflow (form/submission)  
⚪ Lender application review & approval  
⚪ Payment processing  
⚪ Document upload & verification  
⚪ Advanced analytics & reporting  
⚪ Production deployment (Phase 2/3)  

---

## 13. Success Criteria

Phase One is complete when:

1. ✅ Firebase Emulator runs without errors
2. ✅ Test users created and can authenticate
3. ✅ Applicant sees their dashboard after login
4. ✅ Lender sees applications list after login
5. ✅ API routes return data from Firestore
6. ✅ Session persists across page reloads
7. ✅ Role-based access control works (applicants can't see lender-only pages)
8. ✅ All documentation updated and linked
9. ✅ No console errors or warnings in browser/terminal
10. ✅ New developers can set up locally following documentation

---

## 14. Timeline Estimate

| Task | Duration | Status |
|------|----------|--------|
| Firebase setup & emulator | 2-3 hours | Not Started |
| Next.js project setup | 1-2 hours | Not Started |
| Firebase integration (client/server) | 2-3 hours | Not Started |
| Authentication (signup/login) | 3-4 hours | Not Started |
| User role setup | 1-2 hours | Not Started |
| Basic UI (auth pages & dashboards) | 4-5 hours | Not Started |
| API routes | 3-4 hours | Not Started |
| Testing & debugging | 2-3 hours | Not Started |
| Documentation | 2-3 hours | In Progress |
| **Total** | **20-29 hours** | **In Progress** |

---

## Notes & Decisions

- **Emulator Data**: Using persistent storage (`emulator-data/` folder) to retain test data between sessions
- **Security Rules**: Permissive during development; strict rules deployed to production
- **Session Management**: Using HTTP-only cookies with 7-day expiration
- **Encryption**: Store sensitive data with ENCRYPTION_KEY from environment
- **Testing**: Focus on manual testing in Phase 1; automated tests in Phase 2

---

## Contacts & Resources

**Documentation**:
- [FIREBASE_LOCAL_SETUP.md](./FIREBASE_LOCAL_SETUP.md) - Local environment guide
- [PLATFORM_PLAN.md](./PLATFORM_PLAN.md) - Architecture overview
- [DATA_STRUCTURE.md](./DATA_STRUCTURE.md) - Database schema
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) - Feature flag system

**Official Resources**:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Document Version**: 1.0  
**Last Updated**: March 8, 2026  
**Created By**: Development Team  
**Status**: In Progress - Phase One Implementation
