// File: services/TokenService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TokenService = {
  saveToken: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  },
  getToken: async (key) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },
  removeToken: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },
};
