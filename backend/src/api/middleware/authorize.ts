import { UserRole, checkRole } from './auth';

export const authorize = (allowedRoles: UserRole[]) => checkRole(allowedRoles);

export type { UserRole };
