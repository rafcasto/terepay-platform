# Feature Flags Implementation Guide

## 1. Overview

Feature flags provide a mechanism to control feature rollout, A/B testing, and operational switches without code deployment. The TerePay platform implements a Firestore-backed feature flag system with both server-side and client-side evaluation.

---

## 2. Feature Flag Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────┐
│                  Application Layer                  │
│  (Next.js app, React components, API routes)       │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   ┌────▼────┐      ┌────▼────┐
   │ Hooks   │      │ Utilities │
   │ ────────│      │ ────────── │
   │useFlag()│      │useClientFF()│
   │          │      │evaluateFF()  │
   └────┬────┘      └────┬────┘
        │                 │
        ▼                 ▼
┌──────────────────────────────────┐
│   Feature Flag Evaluation Engine   │
│   (lib/flags/engine.ts)           │
└────────────┬─────────────────────┘
             │
        ┌────┴──────┐
        │            │
   ┌────▼──┐    ┌──▼─────┐
   │Server │    │ Client  │
   │-side  │    │-side    │
   │ Rules │    │ Cache   │
   └────┬──┘    └──┬─────┘
        │          │
        └────┬─────┘
             ▼
    ┌────────────────────┐
    │  Firestore DB      │
    │  featureFlags/{id} │
    └────────────────────┘
```

### 2.2 Evaluation Order

1. **Master Switch** - If flag is disabled globally, return false
2. **Time-based** - Check if current time is within schedule
3. **Role-based** - Check if user role matches target roles
4. **User Targeting** - Check if user is in specific users list
5. **Rules Engine** - Evaluate conditional rules
6. **Percentage Rollout** - Hash-based consistent bucketing
7. **Return** - Return true/false based on all conditions

---

## 3. Feature Flag Types

### 3.1 Release Flags
Control gradual rollout of new features.

```typescript
{
  name: "advanced_analytics_dashboard",
  type: "release",
  enabled: true,
  rolloutPercentage: 10,  // Start at 10%, increase daily
  targetRoles: ["lender"],
  description: "Advanced analytics dashboard for lenders"
}
```

**Typical Rollout Pattern:**
- Day 1-2: 10% (Early adopters, internal testing)
- Day 3-4: 25% (Monitor for issues)
- Day 5-6: 50% (Wider testing)
- Day 7+: 100% (Full rollout)

### 3.2 Operational Flags
Control system services and integrations.

```typescript
{
  name: "email_notifications_enabled",
  type: "operational",
  enabled: true,
  description: "Enable/disable email notification service"
}
```

**Use Cases:**
- Temporarily disable external service during maintenance
- Toggle SMS notifications
- Enable/disable specific payment methods
- Pause document processing

### 3.3 Experiment Flags
A/B testing and personalization.

```typescript
{
  name: "new_loan_form_variant_b",
  type: "experiment",
  enabled: true,
  rolloutPercentage: 50,
  targetRoles: ["applicant"],
  rules: [
    {
      condition: "user.metadata.signupDate > 2026-01-01",
      enabled: true,
      priority: 1
    }
  ],
  description: "Test new loan application form UI"
}
```

### 3.4 Permission Flags
Control feature access by role or user attributes.

```typescript
{
  name: "premium_lender_features",
  type: "permission",
  enabled: true,
  targetRoles: ["lender"],
  rules: [
    {
      condition: "user.lender.metrics.activeLoans >= 50",
      enabled: true,
      priority: 1
    }
  ],
  description: "Premium features for high-volume lenders"
}
```

---

## 4. Implementation - Core Engine

### 4.1 Feature Flag Service

**`src/lib/flags/engine.ts`**

```typescript
import { db } from '@/lib/firebase/admin';
import { cache } from 'react';

export interface FeatureFlag {
  flagId: string;
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetRoles: string[];
  targetUsers: string[];
  rules: FlagRule[];
  startDate?: Date;
  endDate?: Date;
}

export interface FlagRule {
  ruleId: string;
  conditions: RuleCondition[];
  enabled: boolean;
  priority: number;
}

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface UserContext {
  userId: string;
  role: 'applicant' | 'lender' | 'admin';
  email: string;
  metadata?: Record<string, any>;
}

// Get all flags from Firestore
export async function getAllFlags(): Promise<FeatureFlag[]> {
  const snapshot = await db
    .collection('featureFlags')
    .where('enabled', '==', true)
    .get();
  
  return snapshot.docs.map(doc => ({
    flagId: doc.id,
    ...doc.data()
  })) as FeatureFlag[];
}

// Get specific flag
export async function getFlag(flagName: string): Promise<FeatureFlag | null> {
  const snapshot = await db
    .collection('featureFlags')
    .where('name', '==', flagName)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return {
    flagId: doc.id,
    ...doc.data()
  } as FeatureFlag;
}

// Evaluate flag for user
export async function evaluateFlag(
  flagName: string,
  user: UserContext
): Promise<boolean> {
  try {
    const flag = await getFlag(flagName);
    
    if (!flag) {
      console.warn(`Feature flag ${flagName} not found`);
      return false;
    }
    
    return evaluateFlagForUser(flag, user);
  } catch (error) {
    console.error(`Error evaluating flag ${flagName}:`, error);
    // Fail-safe: disable new features on error
    return false;
  }
}

// Core evaluation logic
function evaluateFlagForUser(flag: FeatureFlag, user: UserContext): boolean {
  // 1. Master switch
  if (!flag.enabled) {
    return false;
  }
  
  // 2. Time-based check
  const now = new Date();
  if (flag.startDate && now < flag.startDate) {
    return false;
  }
  if (flag.endDate && now > flag.endDate) {
    return false;
  }
  
  // 3. Role targeting
  if (flag.targetRoles.length > 0 && !flag.targetRoles.includes(user.role)) {
    return false;
  }
  
  // 4. Specific user targeting (if list is not empty, user must be in it)
  if (flag.targetUsers.length > 0 && !flag.targetUsers.includes(user.userId)) {
    // Check rules before rejecting - rules can override user list
    if (!evaluateRules(flag.rules, user)) {
      return false;
    }
  }
  
  // 5. Rules engine
  if (!evaluateRules(flag.rules, user)) {
    return false;
  }
  
  // 6. Percentage rollout (consistent hashing)
  if (flag.rolloutPercentage < 100) {
    const hash = hashUserId(user.userId);
    if (hash > flag.rolloutPercentage) {
      return false;
    }
  }
  
  return true;
}

// Evaluate rule conditions
function evaluateRules(rules: FlagRule[], user: UserContext): boolean {
  if (rules.length === 0) {
    return true; // No rules = always pass
  }
  
  // Sort by priority (higher = first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);
  
  for (const rule of sortedRules) {
    if (!rule.enabled) continue;
    
    // All conditions must be true (AND logic)
    const allConditionsMatch = rule.conditions.every(condition =>
      evaluateCondition(condition, user)
    );
    
    if (allConditionsMatch) {
      return true;
    }
  }
  
  // If no rules matched, reject
  return false;
}

// Evaluate single condition
function evaluateCondition(condition: RuleCondition, user: UserContext): boolean {
  const fieldValue = getNestedProperty(user, condition.field);
  
  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'ne':
      return fieldValue !== condition.value;
    case 'gt':
      return Number(fieldValue) > Number(condition.value);
    case 'gte':
      return Number(fieldValue) >= Number(condition.value);
    case 'lt':
      return Number(fieldValue) < Number(condition.value);
    case 'lte':
      return Number(fieldValue) <= Number(condition.value);
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'contains':
      return String(fieldValue).includes(String(condition.value));
    default:
      return false;
  }
}

// Helper: Get nested property from object
function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

// Consistent hashing for percentage rollout
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
}

// Batch evaluate flags for user
export async function evaluateUserFlags(
  user: UserContext
): Promise<Record<string, boolean>> {
  const flags = await getAllFlags();
  
  const results: Record<string, boolean> = {};
  for (const flag of flags) {
    results[flag.name] = evaluateFlagForUser(flag, user);
  }
  
  return results;
}

// Log flag evaluation (for analytics)
export async function logFlagEvaluation(
  flagName: string,
  userId: string,
  result: boolean,
  evaluationTime: number
): Promise<void> {
  // Could be sent to analytics service
  if (process.env.NEXT_PUBLIC_ENABLE_LOGGING) {
    console.log(
      `[FLAG] ${flagName}: ${result} (${evaluationTime}ms)`,
      { userId }
    );
  }
}
```

---

## 5. Client-Side Implementation

### 5.1 Custom Hook - `useFeatureFlag`

**`src/hooks/useFeatureFlag.ts`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { evaluateFlag } from '@/lib/flags/engine';
import type { UserContext } from '@/lib/flags/engine';

export function useFeatureFlag(flagName: string): {
  enabled: boolean;
  loading: boolean;
  error: Error | null;
} {
  const { user, role } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const evaluateAsync = async () => {
      try {
        setLoading(true);
        
        const userContext: UserContext = {
          userId: user.uid,
          role: role as 'applicant' | 'lender' | 'admin',
          email: user.email || '',
          metadata: user.customClaims || {}
        };
        
        const result = await evaluateFlag(flagName, userContext);
        setEnabled(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };
    
    evaluateAsync();
  }, [user, role, flagName]);
  
  return { enabled, loading, error };
}
```

### 5.2 Server-Side Implementation

**`src/lib/flags/server.ts`**

```typescript
import { getFirebaseAuth } from '@/lib/firebase/admin';
import { evaluateFlag } from './engine';
import type { UserContext } from './engine';

export async function getServerFeatureFlag(
  flagName: string,
  userId: string
): Promise<boolean> {
  try {
    const userRecord = await getFirebaseAuth().getUser(userId);
    
    const userContext: UserContext = {
      userId: userRecord.uid,
      role: userRecord.customClaims?.role || 'applicant',
      email: userRecord.email || '',
      metadata: userRecord.customClaims || {}
    };
    
    return await evaluateFlag(flagName, userContext);
  } catch (error) {
    console.error(`Error evaluating server flag ${flagName}:`, error);
    return false;
  }
}
```

---

## 6. API Endpoint

### 6.1 Feature Flags API Route

**`src/app/api/feature-flags/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/middleware/auth';
import { evaluateUserFlags } from '@/lib/flags/engine';
import type { UserContext } from '@/lib/flags/engine';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userContext: UserContext = {
      userId: authResult.userId,
      role: authResult.role as 'applicant' | 'lender' | 'admin',
      email: authResult.email,
      metadata: authResult.customClaims
    };
    
    // Evaluate all flags for user
    const flags = await evaluateUserFlags(userContext);
    
    return NextResponse.json({
      flags,
      evaluatedAt: new Date().toISOString(),
      userId: authResult.userId
    });
  } catch (error) {
    console.error('Feature flag evaluation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Query specific flag
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { flagName } = await request.json();
    
    if (!flagName) {
      return NextResponse.json(
        { error: 'flagName is required' },
        { status: 400 }
      );
    }
    
    const userContext: UserContext = {
      userId: authResult.userId,
      role: authResult.role as 'applicant' | 'lender' | 'admin',
      email: authResult.email,
      metadata: authResult.customClaims
    };
    
    const result = await evaluateFlag(flagName, userContext);
    
    return NextResponse.json({
      flagName,
      enabled: result,
      userId: authResult.userId
    });
  } catch (error) {
    console.error('Feature flag evaluation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 7. Usage Examples

### 7.1 In React Components

```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function ApplicantDashboard() {
  const { enabled: showNewUI } = useFeatureFlag('new_applicant_dashboard');
  const { enabled: advancedSearch } = useFeatureFlag('advanced_search');
  
  if (showNewUI) {
    return <NewDashboard />;
  } else {
    return <LegacyDashboard />;
  }
}
```

### 7.2 In API Routes

```typescript
import { getServerFeatureFlag } from '@/lib/flags/server';

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  
  // Check if feature is enabled for user
  const emailEnabled = await getServerFeatureFlag('send_email_notifications', userId);
  
  if (emailEnabled) {
    await sendEmailNotification(userId);
  }
  
  return NextResponse.json({ success: true });
}
```

### 7.3 Conditional Rendering with Loading State

```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function LoanApplicationForm() {
  const { enabled: showAdvancedOptions, loading } = useFeatureFlag('advanced_loan_options');
  
  if (loading) {
    return <Skeleton />;
  }
  
  return (
    <form>
      <BasicFields />
      {showAdvancedOptions && <AdvancedFields />}
    </form>
  );
}
```

---

## 8. Common Feature Flags

### 8.1 Release Features

```typescript
// New applicant dashboard
{
  name: "new_applicant_dashboard_v2",
  description: "Redesigned applicant dashboard with improved UX",
  enabled: true,
  rolloutPercentage: 25,
  targetRoles: ["applicant"],
  startDate: "2026-03-15T00:00:00Z",
  endDate: "2026-04-15T23:59:59Z"
}

// Advanced analytics for lenders
{
  name: "advanced_analytics",
  description: "Advanced portfolio analytics and insights",
  enabled: true,
  rolloutPercentage: 50,
  targetRoles: ["lender"],
  rules: [
    {
      description: "High-volume lenders get early access",
      conditions: [
        {
          field: "metadata.totalFundsDispersed",
          operator: "gt",
          value: 1000000
        }
      ],
      enabled: true,
      priority: 1
    }
  ]
}
```

### 8.2 Operational Features

```typescript
// Payment processing
{
  name: "payment_processing_enabled",
  description: "Enable/disable payment processing",
  enabled: true,
  rolloutPercentage: 100,
  targetRoles: ["applicant"]
}

// Email notifications
{
  name: "email_notifications",
  description: "Send email notifications",
  enabled: true,
  rolloutPercentage: 100,
  targetRoles: ["applicant", "lender"]
}
```

---

## 9. Best Practices

### 9.1 Flag Naming Convention
- Use kebab-case: `new_dashboard`, `advanced_search`
- Include feature name and version: `advanced_search_v2`
- Functional names: `email_notifications_enabled`

### 9.2 Lifecycle Management
- **Creation**: Start at 0% rollout for internal testing
- **Testing**: Increase to 10-25% for early adopters
- **Monitoring**: Watch error rates and metrics
- **Rollout**: Increase daily (25% → 50% → 100%)
- **Cleanup**: Remove flag from code after 2 weeks at 100%
- **Removal**: Delete from Firestore after 30 days

### 9.3 Monitoring
- Track which features are enabled per user
- Monitor error rates with and without feature
- Alert on unusual flag evaluation patterns
- Log flag changes for audit trail

### 9.4 Cleanup Script

```bash
# Mark flag for removal (add removedAt timestamp)
npm run flags:deprecate <flag-name>

# Remove all deployment references
npm run flags:cleanup <flag-name>

# Delete from Firestore
npm run flags:delete <flag-name>
```

---

## 10. Migration Path for Features

### Old Feature (Code-based)
```typescript
if (process.env.NEXT_PUBLIC_NEW_DASHBOARD === 'true') {
  // Show new dashboard
}
```

### Transition (Using feature flag)
```typescript
const { enabled } = useFeatureFlag('new_dashboard');
// Show based on dynamic flag
```

### Removal (After full rollout)
```typescript
// Remove flag check, new dashboard is default
return <NewDashboard />;
```

---

## Document References
- [PLATFORM_PLAN.md](./PLATFORM_PLAN.md) - Architecture overview
- [DATA_STRUCTURE.md](./DATA_STRUCTURE.md) - Feature flags schema
- [DEPLOYMENT.md](./DEPLOYMENT.md) - CI/CD integration

