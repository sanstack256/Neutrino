/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@neutrino/contracts'],
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
