/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true 
  }
}

module.exports = nextConfig