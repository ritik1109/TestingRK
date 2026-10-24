// Use Expo's maintained Babel preset for native and web bundling.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
