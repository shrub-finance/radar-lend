const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  webpack: (config, options) => {
    return config;
  },
};

module.exports = nextConfig;
