const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [/\.d\.ts$/, /node_modules[\\/]prettier[\\/]/];

module.exports = withNativewind(config, { inlineRem: 16 });