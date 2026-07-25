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
    optimizePackageImports: ['lucide-react'],
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
    
    return config;
  },
};

export default nextConfig;