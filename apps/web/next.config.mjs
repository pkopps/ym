const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.YARDMATCH_NEXT_DIST_DIR ?? ".next",
  transpilePackages: [
    "@yardmatch/branding",
    "@yardmatch/contracts",
    "@yardmatch/domain",
    "@yardmatch/i18n",
    "@yardmatch/ui",
    "@yardmatch/analytics",
    "@yardmatch/observability"
  ],
  async redirects() {
    return [
      {
        source: "/auth/provider",
        destination: "/provider",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
