import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Layout, ProtectedRoute } from '@/components/layout';
import { LoadingSpinner } from '@/components/common';

/**
 * Legacy OT route – redirect into the combined work records page (OT tab).
 */
export default function OvertimeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(
      {
        pathname: '/daily-reports',
        query: { view: 'ot' },
      },
      '/daily-reports?view=ot'
    );
  }, [router]);

  return (
    <ProtectedRoute requiredRoles={['SE', 'OE', 'PE', 'PM', 'PD', 'AM']}>
      <Layout>
        <LoadingSpinner message="กำลังเปลี่ยนเส้นทางไปยังรายการ OT..." />
      </Layout>
    </ProtectedRoute>
  );
}
