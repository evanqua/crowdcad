'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const AppNavbar = dynamic(() => import('@/components/layout/appnavbar'), { ssr: false });

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