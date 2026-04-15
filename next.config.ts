import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React strict mode to prevent double-mounting audio/canvas hooks
  reactStrictMode: false,
  images: {
    // Allow serving avatar images from the public/ directory
    unoptimized: true,
  },
  // Turbopack config (Next.js 16 dev default)
  turbopack: {
    rules: {
      // Allow importing .md files as raw strings (persona prompts)
      '*.md': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
  // Webpack config (production builds)
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    });
    return config;
  },
};

export default nextConfig;
