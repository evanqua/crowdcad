'use client';

import { usePathname } from 'next/navigation';
import AppNavbar from '@/components/layout/appnavbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLiteRoute = pathname?.startsWith('/lite');

  return (
    <>
      {!isLiteRoute && <AppNavbar />}
      <div>{children}</div>
    </>
  );
}