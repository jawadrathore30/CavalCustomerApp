import Constants from "expo-constants"
import { Platform } from "react-native"

const __DEV__ = Platform.OS !== "production"

// Helper function to get environment variables in both development and production
export const getEnvVar = (key) => {
  // In development, try process.env first
  if (__DEV__ && process.env[key]) {
    return process.env[key]
  }

  // In production, get from Constants.expoConfig.extra
  return Constants.expoConfig?.extra?.[key] || Constants.manifest?.extra?.[key]
}

// Export commonly used environment variables
export const CONFIG = {
  GOOGLE_MAPS_API_KEY: getEnvVar("googleMapsApiKey") || getEnvVar("GOOGLE_MAPS_API_KEY"),
  FIREBASE_API_KEY: getEnvVar("firebaseApiKey") || getEnvVar("FIREBASE_API_KEY"),
  FIREBASE_AUTH_DOMAIN: getEnvVar("firebaseAuthDomain") || getEnvVar("FIREBASE_AUTH_DOMAIN"),
  FIREBASE_PROJECT_ID: getEnvVar("firebaseProjectId") || getEnvVar("FIREBASE_PROJECT_ID"),
  FIREBASE_STORAGE_BUCKET: getEnvVar("firebaseStorageBucket") || getEnvVar("FIREBASE_STORAGE_BUCKET"),
  FIREBASE_MESSAGING_SENDER_ID: getEnvVar("firebaseMessagingSenderId") || getEnvVar("FIREBASE_MESSAGING_SENDER_ID"),
  FIREBASE_APP_ID: getEnvVar("firebaseAppId") || getEnvVar("FIREBASE_APP_ID"),
  FIREBASE_MEASUREMENT_ID: getEnvVar("firebaseMeasurementId") || getEnvVar("FIREBASE_MEASUREMENT_ID"),
}

// Debug function to log configuration
export const debugConfig = () => {
  console.log("Environment Configuration:", {
    isDev: __DEV__,
    hasGoogleMapsKey: !!CONFIG.GOOGLE_MAPS_API_KEY,
    hasFirebaseKey: !!CONFIG.FIREBASE_API_KEY,
    expoConfig: !!Constants.expoConfig,
    manifest: !!Constants.manifest,
    platform: Platform.OS,
  })
}
