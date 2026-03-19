import type { Metadata } from 'next';
import { LiteProvider } from '@/lib/LiteContext';
import LiteNavbar from '@/components/layout/litenavbar';

/**
 * Lite Layout
 *
 * This is a separate layout for Lite (local-only) routes at /lite/*.
 * Key differences from the cloud layout:
 *
 * - NO AppNavbar (no cloud actions, no auth UI)
 * - NO assumption of Firebase auth state
 * - LiteProvider wraps all Lite children with isLiteMode=true
 * - All Lite pages are completely local and backend-agnostic
 *
 * Lite pages under this layout MUST NOT:
 * - Import firebase.ts, Auth, Firestore, or Storage
 * - Call useAuth() or any cloud hooks
 * - Perform cloud writes or cloud reads
 *
 * This isolation guarantees that Lite mode is user-data-local.
 */

export const metadata: Metadata = {
  title: 'CrowdCAD Lite',
  description: 'Browser-local dispatch mode for volunteer medical teams — no internet required',
};

export default function LiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiteProvider isLiteMode={true}>
      <LiteNavbar />
      <div className="h-[calc(100dvh-4rem)]">{children}</div>
    </LiteProvider>
  );
}
