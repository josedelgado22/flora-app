const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const current = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(current) ? current : current ? [current] : []),
  /flora_backend[\/\\].*/, // ignora el backend Python
];

module.exports = config;