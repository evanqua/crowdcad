/** @type {import('next').NextConfig} */
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Ensure Next.js traces output from the project root (Dispatch)
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    remotePatterns: [
      // Classic Firebase Storage REST endpoint
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**', // allow any bucket path
      },
      // Alternate Google Storage endpoint (some URLs resolve here)
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      // App Check / modern storage domains for your bucket
      // Replace dispatch-60ca7 with YOUR actual bucket name if different
      {
        protocol: 'https',
        hostname: 'dispatch-60ca7.firebasestorage.app',
        pathname: '/**',
      },
      // If your bucket is regionalized and uses a regional subdomain, add a wildcard:
      {
        protocol: 'https',
        hostname: '*.firebasestorage.app',
        pathname: '/**',
      },
      // Self-hosted PocketBase (NEXT_PUBLIC_BACKEND=pocketbase) serves uploaded
      // files -- including venue map images -- from its own /api/files route.
      // next/image refuses to load from any host not listed here, so without
      // these entries a venue map stored in PocketBase silently fails to
      // render while the Firebase path works fine. Restricted to the file
      // route and to loopback, so this does not widen anything in a deployed
      // build; a LAN or remote PocketBase needs its own entry.
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8090',
        pathname: '/api/files/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8090',
        pathname: '/api/files/**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;