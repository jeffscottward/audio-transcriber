/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  webpack: (config, { isServer }) => {
    // Exclude node-specific modules from the client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        process: false,
        url: false,
        querystring: false,
      };
      
      // Exclude onnxruntime-node from client-side bundle but allow onnxruntime-web
      config.externals = config.externals || [];
      config.externals.push({
        'onnxruntime-node': 'onnxruntime-node',
        'sharp': 'sharp',
        'canvas': 'canvas'
      });
      
      // Alias onnxruntime-node to onnxruntime-web in browser
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': 'onnxruntime-web'
      };
    }
    
    // Handle .node files
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader'
    });
    
    // Handle WASM files for onnxruntime-web
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async'
    });
    
    // Ensure WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true
    };
    
    return config;
  },
  
  // Ignore build warnings for node modules
  typescript: {
    ignoreBuildErrors: false,
  },
  
  eslint: {
    ignoreDuringBuilds: false,
  }
};

module.exports = nextConfig;
