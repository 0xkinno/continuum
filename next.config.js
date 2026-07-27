/** @type {import('next').NextConfig} */
const nextConfig = {
  // All backend calls proxy through Next.js to the Fastify service
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
