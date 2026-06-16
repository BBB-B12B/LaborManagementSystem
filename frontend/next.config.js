/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Static export - deploy to Firebase Hosting CDN directly (no SSR needed, app is client-side)
  output: 'export',

  transpilePackages: ['@mui/x-date-pickers', '@mui/x-data-grid'],

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NEXT_PUBLIC_FIREBASE_EMULATOR_HOST: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST,
    NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST,
    NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED,
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },

  // Image optimization disabled for static export
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
