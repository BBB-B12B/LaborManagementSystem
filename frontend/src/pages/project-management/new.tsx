import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ProjectCreateRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/project-management');
  }, [router]);

  return null;
}
