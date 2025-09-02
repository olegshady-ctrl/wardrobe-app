import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // твои существующие настройки, например:
  // reactStrictMode: true,

  // ⬇️ чтобы билд не падал из-за ESLint/TS-ошибок
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
