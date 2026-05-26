const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@yardmatch/branding",
    "@yardmatch/contracts",
    "@yardmatch/domain",
    "@yardmatch/ui",
    "@yardmatch/analytics",
    "@yardmatch/observability"
  ]
};

export default nextConfig;
