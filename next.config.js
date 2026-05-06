/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep dev artifacts separate from production build artifacts.
  // This prevents chunk collisions when `next dev` and `next build`
  // are run in nearby sessions on Windows.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid stale chunk IDs (Cannot find module './9276.js') when the webpack
      // filesystem cache references chunks that never landed on disk — common on Windows
      // with interrupted saves, AV locks, or hot reload races.
      config.cache = false
    }
    return config
  },
}

module.exports = nextConfig
