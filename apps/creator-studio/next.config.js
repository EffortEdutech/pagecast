/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @napi-rs/canvas requires native bindings unavailable in Next.js SSR bundle.
      // Externalize it so it is required at runtime (not bundled at build time).
      config.externals.push('@napi-rs/canvas')
    }
    return config
  },
}

module.exports = nextConfig
