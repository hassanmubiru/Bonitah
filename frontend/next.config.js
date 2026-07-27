/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Handle CORS policy issues
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },

  // Experimental features for better performance
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
    // Enable modern bundling optimizations
    esmExternals: true,
  },

  // Move server external packages to the correct location
  serverExternalPackages: ['viem', 'wagmi'],

  // Optimize images and static assets
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Enable compression
  compress: true,

  // Optimize build output
  output: 'standalone',
  
  // Reduce bundle size
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
  },

  // Turbopack configuration (Next.js 16+ default in dev mode)
  turbopack: {
    root: '/home/error51/project/Bonitah',
    resolveAlias: {
      '@x402/evm/upto/client': './public/x402-fallback.js',
      '@x402/evm/exact/client': './public/x402-fallback.js',
      '@x402/core/client': './public/x402-fallback.js',
      '@x402/svm/exact/client': './public/x402-fallback.js',
      '@x402/evm': './public/x402-fallback.js',
      '@x402/svm': './public/x402-fallback.js',
      '@x402/core': './public/x402-fallback.js',
      '@react-native-async-storage/async-storage': './public/x402-fallback.js',
    },
  },

  // Webpack configuration for better tree-shaking and performance
  webpack: (config, { isServer, dev }) => {
    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        minimize: true,
      };
    }

    if (!isServer && config.optimization?.splitChunks) {
      // Ensure splitChunks is properly configured
      if (typeof config.optimization.splitChunks === 'boolean') {
        config.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {},
        };
      }

      // Optimize client bundle with better chunk splitting
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        // Separate wagmi/viem bundle for better caching
        wagmi: {
          name: 'wagmi',
          test: /[\\/]node_modules[\\/](wagmi|@wagmi|viem|@rainbow-me)[\\/]/,
          chunks: 'all',
          priority: 30,
          enforce: true,
        },
        // Separate Radix UI components
        radix: {
          name: 'radix',
          test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
          chunks: 'all',
          priority: 25,
          enforce: true,
        },
        // React Query bundle
        reactQuery: {
          name: 'react-query',
          test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
          chunks: 'all',
          priority: 20,
          enforce: true,
        },
        // Common vendor libraries
        vendor: {
          name: 'vendor',
          test: /[\\/]node_modules[\\/]/,
          chunks: 'all',
          priority: 10,
          minChunks: 2,
        },
      };
    }

    // Optimize module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      // Dedupe React to prevent multiple versions (use import.meta.resolve in ESM)
    };

    // Provide fallbacks for missing @x402 dependencies that are required by @coinbase/cdp-sdk
    // and React Native dependencies that MetaMask SDK tries to import
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@x402/evm/upto/client': false,
      '@x402/evm/exact/client': false,
      '@x402/core/client': false,
      '@x402/svm/exact/client': false,
      '@x402/evm': false,
      '@x402/svm': false,
      '@x402/core': false,
      '@react-native-async-storage/async-storage': false,
    };

    return config;
  },
};

export default nextConfig;
