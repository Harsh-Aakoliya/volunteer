const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname)

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