/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Temporarily skip type checking during build for Next.js 16 upgrade
  typescript: {
    ignoreBuildErrors: true,
  },
  
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
    optimizePackageImports: ['lucide-react'],
  },
  
  // Turbopack configuration (Next.js 16+ default in dev mode)
  turbopack: {
    root: process.cwd(),
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
  
  // Webpack configuration for better tree-shaking
  webpack: (config, { isServer }) => {
    if (!isServer && config.optimization?.splitChunks) {
      // Ensure splitChunks is properly configured
      if (typeof config.optimization.splitChunks === 'boolean') {
        config.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {},
        };
      }
      
      // Optimize client bundle
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        wagmi: {
          name: 'wagmi',
          test: /[\\/]node_modules[\\/](wagmi|@wagmi|viem|@rainbow-me)[\\/]/,
          chunks: 'all',
          priority: 20,
        },
      };
    }

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