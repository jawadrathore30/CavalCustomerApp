import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple polyfill for idb using AsyncStorage
const idbPolyfill = {
  openDB: async (name, version, { upgrade } = {}) => {
    return {
      transaction: (storeName) => ({
        objectStore: (store) => ({
          get: async (key) => {
            const value = await AsyncStorage.getItem(`${name}_${store}_${key}`);
            return value ? JSON.parse(value) : undefined;
          },
          put: async (value, key) => {
            await AsyncStorage.setItem(`${name}_${store}_${key}`, JSON.stringify(value));
          },
          delete: async (key) => {
            await AsyncStorage.removeItem(`${name}_${store}_${key}`);
          }
        }),
        done: Promise.resolve()
      })
    };
  }
};

export default idbPolyfill; 