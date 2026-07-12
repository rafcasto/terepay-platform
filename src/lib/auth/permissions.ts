import type { UserRole } from '@/types/user';

type Permission =
  | 'applications:create'
  | 'applications:create:on_behalf'
  | 'applications:read:own'
  | 'applications:read:all'
  | 'applications:update:own'
  | 'applications:approve'
  | 'applications:reassign'
  | 'customers:create'
  | 'customers:read:all'
  | 'users:read:own'
  | 'users:update:own'
  | 'users:read:all'
  | 'users:create:lender'
  | 'users:update:any'
  | 'users:assign:roles'
  | 'payments:create'
  | 'payments:read:own'
  | 'payments:read:all'
  | 'content:read'
  | 'content:update'
  | 'email_templates:read'
  | 'email_templates:update'
  | 'admin:settings'
  | 'admin:config'
  | 'admin:email_templates';

const CONTENT_EDITOR_PERMISSIONS: Permission[] = [
  'users:read:own',
  'users:update:own',
  'content:read',
  'content:update',
  'email_templates:read',
  'email_templates:update',
];

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
    'applications:create:on_behalf',
    'customers:create',
    'customers:read:all',
    'users:read:own',
    'users:update:own',
    'users:read:all',
    'payments:read:all',
  ],
  content_editor: CONTENT_EDITOR_PERMISSIONS,
  admin: [
    'applications:create',
    'applications:create:on_behalf',
    'applications:read:own',
    'applications:read:all',
    'applications:update:own',
    'applications:approve',
    'applications:reassign',
    'customers:create',
    'customers:read:all',
    'users:read:own',
    'users:update:own',
    'users:read:all',
    'users:create:lender',
    'users:update:any',
    'users:assign:roles',
    'payments:create',
    'payments:read:own',
    'payments:read:all',
    'content:read',
    'content:update',
    'email_templates:read',
    'email_templates:update',
    'admin:settings',
    'admin:config',
    'admin:email_templates',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** True if *any* of the user's roles grants the permission. */
export function anyRoleHasPermission(roles: UserRole[], permission: Permission): boolean {
  return roles.some((role) => hasPermission(role, permission));
}
