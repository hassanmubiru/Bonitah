/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',

  // Transpile the shared workspace package
  transpilePackages: ['@bfn/shared'],

  // Handle CORS policy issues
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
        ],
      },
    ];
  },

  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  compress: true,

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-slot',
      '@radix-ui/react-progress',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
    ],
  },

  // wagmi/RainbowKit pull in optional deps that are safe to leave unresolved
  webpack: (config, { webpack }) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@x402\//,
      }),
    );
    // Fallbacks for optional deps
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

export default nextConfig;
