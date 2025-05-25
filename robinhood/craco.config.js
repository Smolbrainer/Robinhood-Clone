// craco.config.js
const path = require("path");
const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // 1) Remove CRA's ModuleScopePlugin
      webpackConfig.resolve.plugins = webpackConfig.resolve.plugins.filter(
        (plugin) => !(plugin instanceof ModuleScopePlugin)
      );

      // 2) Force all react/react-dom imports to your one copy
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        react:   path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      };

      return webpackConfig;
    },
  },
};
