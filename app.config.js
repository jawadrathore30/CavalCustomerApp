import "dotenv/config"

export default {
  expo: {
    name: "Caval",
    slug: "Eco-share",
    owner: "zouhair123",
    version: "1.0.0",
    runtimeVersion: {
      policy: "sdkVersion",
    },
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "com.googleusercontent.apps.1007561335979-uiduf2a3h59mjcdassp5hl3rgljr5tes",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.misscoding.Eco-Share",
      googleServicesFile: "./GoogleService-Info.plist",
      newArchEnabled: true,
      buildNumber: "1",
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "We need your location to show nearby rides and provide accurate navigation.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "We need your location to show nearby rides and provide accurate navigation even when the app is in the background.",
        NSLocationAlwaysUsageDescription:
          "We need your location to show nearby rides and provide accurate navigation even when the app is in the background.",
        NSCameraUsageDescription:
          "We need access to your camera to allow you to take profile pictures and document your rides.",
        NSPhotoLibraryUsageDescription:
          "We need access to your photo library to allow you to select profile pictures and document your rides.",
        UIBackgroundModes: ["location", "fetch"],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.misscoding.ecoshare",
      versionCode: 105,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "ACCESS_BACKGROUND_LOCATION"],
      googleServicesFile: "./google-services.json",
    },
    web: {
      favicon: "./assets/favicon.png",
      config: {
        firebase: {
          apiKey: process.env.FIREBASE_API_KEY,
          authDomain: process.env.FIREBASE_AUTH_DOMAIN,
          projectId: process.env.FIREBASE_PROJECT_ID,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.FIREBASE_APP_ID,
          measurementId: process.env.FIREBASE_MEASUREMENT_ID,
        },
      },
    },
    extra: {
      eas: {
        projectId: "97f35a2b-2bbf-4893-9f43-cd2df775196a",
      },
      // Make environment variables available to the app
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID,
    },
    plugins: [
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow Eco-share to use your location to show nearby rides and provide accurate navigation.",
          locationAlwaysPermission:
            "Allow Eco-share to use your location to show nearby rides and provide accurate navigation even when the app is in the background.",
          locationWhenInUsePermission:
            "Allow Eco-share to use your location to show nearby rides and provide accurate navigation.",
        },
      ],
    ],
  },
}
