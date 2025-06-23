module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "react-native-reanimated/plugin",
      "@babel/plugin-transform-runtime",
      [
        "module-resolver",
        {
          alias: {
            "@components": "./components",
            "@screens": "./screens",
            "@navigation": "./navigation",
            "@utils": "./utils",
            "@assets": "./assets",
          },
        },
      ],
      ["module:react-native-dotenv", {
        "moduleName": "@env",
        "path": ".env",
        "blacklist": null,
        "whitelist": null,
        "safe": false,
        "allowUndefined": true
      }]
    ],
  };
};
