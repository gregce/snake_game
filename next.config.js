/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three', 'three-mesh-bvh', '@react-three/drei', '@react-three/fiber'],
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true 
  },
  webpack: (config) => {
    // Add a fallback for the 'fs' module which is used by some Three.js examples
    config.resolve.fallback = { 
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    
    return config;
  }
}

module.exports = nextConfig