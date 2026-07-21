import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the file-tracing root to the monorepo root so Next does not misinfer it
  // from an unrelated lockfile higher up the tree.
  outputFileTracingRoot: join(__dirname, '..'),
  // Transpile the shared workspace package so its ESM source is bundled correctly.
  transpilePackages: ['@bfn/shared'],
  // wagmi/RainbowKit pull in optional pino-pretty/lokijs/encoding deps that are
  // safe to leave unresolved in the browser bundle.
  webpack: (config, { webpack }) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    // The Coinbase wallet connector's CDP SDK references optional @x402/* payment
    // modules that BFN does not use and are not installed. Ignore them so they do
    // not break the bundle; they live in unused code paths.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@x402\//,
      }),
    );
    return config;
  },
};

export default nextConfig;
