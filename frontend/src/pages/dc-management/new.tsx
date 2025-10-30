import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LegacyDCCreateRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dc-management');
  }, [router]);

  return null;
}
