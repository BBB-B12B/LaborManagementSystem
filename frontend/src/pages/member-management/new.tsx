/**
 * Member Management - Create User Page
 * หน้าสร้างผู้ใช้ใหม่
 *
 * Features:
 * - Create new user with all required fields
 * - Password validation (>= 8 characters, bcrypt hashing in backend)
 * - Username uniqueness check
 * - Admin only access (FR-M-001)
 *
 * User Story: US5 - Member Management (Priority 5)
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function CreateUserPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/member-management');
  }, [router]);

  return null;
}
