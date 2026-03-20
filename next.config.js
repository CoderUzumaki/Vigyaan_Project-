/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pg', '@hyperledger/fabric-gateway', '@grpc/grpc-js'],
  },
};

module.exports = nextConfig;
