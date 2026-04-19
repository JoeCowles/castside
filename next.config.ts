import type { NextConfig } from "next";

// When building the Electron distribution, generate a pure static export
// (no Node.js server needed inside the packaged app).
// The web deployment to Vercel continues to use the default SSR mode.
const isElectronBuild = process.env.ELECTRON_BUILD === '1';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Static export for Electron packaging; omit for Vercel SSR
  ...(isElectronBuild && { output: 'export', distDir: 'out' }),
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      '*.md': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
