const { getDefaultConfig } = require("@expo/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    sourceExts: ["jsx", "js", "ts", "tsx", "cjs", "mjs", "json"],
    assetExts: [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "ttf",
      "otf",
      "woff",
      "woff2",
      "db",
    ],
    extraNodeModules: {
      idb: require.resolve("idb"),
    },
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.includes("idb") && !moduleName.endsWith(".js")) {
        try {
          return {
            filePath: require.resolve("idb"),
            type: "sourceFile",
          };
        } catch (e) {
          // Fall back to default resolver
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
  transformer: {
    ...defaultConfig.transformer,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = config;
