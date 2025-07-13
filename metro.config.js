const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname)

// Add tree-shaking and optimization
config.transformer.minifierConfig = {
  mangle: {
    keep_fnames: true,
  },
  output: {
    ascii_only: true,
    quote_style: 3,
    wrap_iife: true,
  },
  sourceMap: false,
  toplevel: false,
  warnings: false,
  parse: {
    html5_comments: false,
  },
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
  },
};

// Exclude Backend and other server-side files from Metro bundling
config.resolver.blockList = [
  /Backend\/.*/,
  /demo\/.*/,
  /management\/.*/,
  /VM file media upload demo\/.*/,
  /\.sql$/,
  /\.md$/,
  /\.ps1$/,
];

// Exclude Backend from watchFolders
config.watchFolders = config.watchFolders || [];

module.exports = withNativeWind(config, { input: './global.css' })