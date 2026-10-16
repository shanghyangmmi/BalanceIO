/**
 * BalanceIO — Role-Based Action Control (RBAC) Configuration Matrix
 * Defines explicit action capabilities per user role class:
 * - Owner: Full administrative & destructive controls.
 * - Manager: Full operational & deletion capabilities.
 * - Staff: Operational entries, draft edits, unpost/revert permissions (Deletion restricted).
 * - Viewer: Read-only reporting access.
 */

export type UserRole = "Owner" | "Manager" | "Staff" | "Viewer" | "Admin";

export interface RoleActionCapabilities {
  canView: boolean;
  canCreate: boolean;
  canEditDraft: boolean;
  canPost: boolean;
  canUnpost: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canClosePeriod: boolean;
}

export const ROLE_ACTION_MATRIX: Record<UserRole, RoleActionCapabilities> = {
  Owner: {
    canView: true,
    canCreate: true,
    canEditDraft: true,
    canPost: true,
    canUnpost: true,
    canDelete: true, // Owner can delete
    canApprove: true,
    canClosePeriod: true,
  },
  Admin: {
    canView: true,
    canCreate: true,
    canEditDraft: true,
    canPost: true,
    canUnpost: true,
    canDelete: true, // Admin can delete
    canApprove: true,
    canClosePeriod: true,
  },
  Manager: {
    canView: true,
    canCreate: true,
    canEditDraft: true,
    canPost: true,
    canUnpost: true,
    canDelete: true, // Manager can delete
    canApprove: true,
    canClosePeriod: false,
  },
  Staff: {
    canView: true,
    canCreate: true,
    canEditDraft: true,
    canPost: true,
    canUnpost: true, // Regular staff can unpost/revert to draft
    canDelete: false, // Regular staff CANNOT delete (Owner/Manager only)
    canApprove: false,
    canClosePeriod: false,
  },
  Viewer: {
    canView: true,
    canCreate: false,
    canEditDraft: false,
    canPost: false,
    canUnpost: false,
    canDelete: false,
    canApprove: false,
    canClosePeriod: false,
  },
};

/**
 * Check if a given user role has permission to execute an action.
 */
export function checkRoleCapability(
  role: UserRole | string | undefined,
  action: keyof RoleActionCapabilities
): boolean {
  if (!role) return false;
  const normalizedRole = (role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()) as UserRole;
  const capabilities = ROLE_ACTION_MATRIX[normalizedRole] || ROLE_ACTION_MATRIX.Staff;
  return capabilities[action] ?? false;
}
