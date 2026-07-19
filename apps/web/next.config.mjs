const nextConfig = {
  reactStrictMode: true,
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
