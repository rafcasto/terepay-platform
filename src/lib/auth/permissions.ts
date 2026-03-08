import type { UserRole } from '@/types/user';

type Permission =
  | 'applications:create'
  | 'applications:read:own'
  | 'applications:read:all'
  | 'applications:update:own'
  | 'applications:approve'
  | 'users:read:own'
  | 'users:update:own'
  | 'users:read:all'
  | 'payments:create'
  | 'payments:read:own'
  | 'payments:read:all';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  applicant: [
    'applications:create',
    'applications:read:own',
    'applications:update:own',
    'users:read:own',
    'users:update:own',
    'payments:create',
    'payments:read:own',
  ],
  lender: [
    'applications:read:all',
    'applications:approve',
    'users:read:own',
    'users:update:own',
    'users:read:all',
    'payments:read:all',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
