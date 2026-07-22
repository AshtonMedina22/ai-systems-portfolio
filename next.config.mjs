/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/sre",
        destination: "/migrate",
        permanent: true,
      },
      {
        source: "/guardrails",
        destination: "/workflow",
        permanent: true,
      },
      {
        source: "/evals",
        destination: "/workflow",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
