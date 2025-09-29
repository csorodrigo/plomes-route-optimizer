const webpack = require('webpack');

module.exports = {
  eslint: {
    enable: false, // Disable ESLint temporarily to speed up compilation
  },
  webpack: {
    configure: (webpackConfig) => {
      // Exclude Storybook files from production build
      if (process.env.NODE_ENV === 'production') {
        webpackConfig.plugins.push(
          new webpack.NormalModuleReplacementPlugin(
            /\.(stories|story)\.(js|jsx|ts|tsx)$/,
            require.resolve('./empty-module.js')
          )
        );
      }
      // Add polyfills for Node.js modules in Webpack 5
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify"),
        "url": require.resolve("url"),
        "zlib": require.resolve("browserify-zlib"),
        "path": require.resolve("path-browserify"),
        "util": require.resolve("util"),
        "buffer": require.resolve("buffer"),
        "process": require.resolve("process/browser.js"),
        "fs": false,
        "net": false,
        "tls": false
      };

      // Add plugins for polyfills
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          process: 'process/browser.js',
          Buffer: ['buffer', 'Buffer'],
        }),
      ];

      // Disable source map loader for problematic packages
      webpackConfig.module.rules = webpackConfig.module.rules.map(rule => {
        if (rule.oneOf) {
          rule.oneOf = rule.oneOf.map(oneOfRule => {
            if (oneOfRule.use && oneOfRule.use.find && oneOfRule.use.find(use =>
              use.loader && use.loader.includes('source-map-loader')
            )) {
              // Exclude problematic packages from source-map-loader
              oneOfRule.exclude = [
                ...(oneOfRule.exclude || []),
                /node_modules\/react-router-dom/,
                /node_modules\/@mui/,
                /node_modules\/@emotion/,
                /node_modules\/@tanstack/,
                /node_modules\/leaflet/,
                /node_modules\/react-leaflet/,
                /node_modules\/jspdf/,
                /node_modules\/html2canvas/,
                /node_modules\/react-beautiful-dnd/,
              ];
            }
            return oneOfRule;
          });
        }

        // Also handle direct source-map-loader rules
        if (rule.use && rule.use.find && rule.use.find(use =>
          use.loader && use.loader.includes('source-map-loader')
        )) {
          rule.exclude = [
            ...(rule.exclude || []),
            /node_modules\/react-router-dom/,
            /node_modules\/@mui/,
            /node_modules\/@emotion/,
            /node_modules\/@tanstack/,
            /node_modules\/leaflet/,
            /node_modules\/react-leaflet/,
            /node_modules\/jspdf/,
            /node_modules\/html2canvas/,
            /node_modules\/react-beautiful-dnd/,
          ];
        }

        return rule;
      });

      // Ignore source map warnings for node_modules
      webpackConfig.ignoreWarnings = [
        {
          module: /node_modules/,
          message: /Failed to parse source map/,
        },
        {
          module: /node_modules/,
          message: /ENOENT: no such file or directory/,
        },
        function(warning) {
          return (
            warning.module &&
            warning.module.resource &&
            warning.module.resource.includes('node_modules') &&
            (warning.message.includes('source map') ||
             warning.message.includes('ENOENT') ||
             warning.message.includes('.mjs'))
          );
        },
      ];

      return webpackConfig;
    },
  },
  devServer: {
    port: 3000,
    setupMiddlewares: (middlewares, devServer) => {
      // Custom middleware setup if needed
      return middlewares;
    },
    // Additional configuration to handle source map issues
    client: {
      overlay: {
        warnings: false,
        errors: true,
        runtimeErrors: (error) => {
          // Only show runtime errors, not source map warnings
          return !error.message.includes('source map') &&
                 !error.message.includes('ENOENT') &&
                 !error.message.includes('.mjs');
        },
      },
    },
  },
};