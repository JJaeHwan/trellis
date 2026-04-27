/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdf-parse 가 fs/path 같은 노드 내장에 의존 → 서버 컴포넌트에서만 사용
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
