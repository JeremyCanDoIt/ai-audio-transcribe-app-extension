// chrome-extension/webpack.config.js

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  
  // Multiple entry points for different parts of the extension
  entry: {
    'background/service-worker': './background/service-worker.js',
    'popup/popup': './popup/popup.js',
    'content/content-script': './content/content-script.js'
  },
  
  // Output configuration
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true // Clean dist folder on each build
  },
  
  // Module rules for processing different file types
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      }
    ],
  },
  
  // Plugins for copying static files
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy manifest.json to dist
        { 
          from: 'manifest.json', 
          to: 'manifest.json' 
        },
        // Copy popup HTML and CSS
        { 
          from: 'popup/popup.html', 
          to: 'popup/popup.html' 
        },
        { 
          from: 'popup/popup.css', 
          to: 'popup/popup.css' 
        },
        // Copy assets (icons, etc.) if they exist
        { 
          from: 'assets', 
          to: 'assets',
          noErrorOnMissing: true // Don't fail if assets folder doesn't exist yet
        }
      ],
    }),
  ],
  
  // Chrome extension specific configuration
  resolve: {
    extensions: ['.js', '.json']
  },
  
  // Development configuration
  devtool: 'cheap-module-source-map', // Good for debugging
  
  // Watch mode configuration
  watchOptions: {
    ignored: /node_modules/,
    poll: 1000 // Check for changes every second
  }
};