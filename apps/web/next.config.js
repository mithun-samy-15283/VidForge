/** @type {import('next').NextConfig} */
const apiUrl = normalizeServiceUrl(process.env.API_URL || 'http://localhost:4000');

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`
      }
    ];
  }
};

function normalizeServiceUrl(value) {
  const trimmed = value.replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

module.exports = nextConfig;
