'use client';

import dynamic from 'next/dynamic';

const VenueManagementClient = dynamic(() => import('./page.client'), { ssr: false });

export default function VenueManagementClientLoader() {
  return <VenueManagementClient />;
}
