import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, firestore } from '../firebase.config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create the context
const AuthContext = createContext({});

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch user data from Firestore
  const fetchUserData = async (firebaseUser) => {
    try {
      const docRef = doc(firestore, "Customers", firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          firstName: userData.firstName || firebaseUser.displayName?.split(' ')[0] || "",
          lastName: userData.lastName || firebaseUser.displayName?.split(' ').slice(1).join(' ') || "",
          number: userData.number || "",
          photo: userData.photo || firebaseUser.photoURL || null,
          ...userData
        };
      } else {
        // Return basic user data if Firestore document doesn't exist
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          firstName: firebaseUser.displayName?.split(' ')[0] || "",
          lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || "",
          photo: firebaseUser.photoURL || null
        };
      }
    } catch (error) {
      console.error('Error fetching user data from Firestore:', error);
      // Return basic user data if there's an error
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        firstName: firebaseUser.displayName?.split(' ')[0] || "",
        lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || "",
        photo: firebaseUser.photoURL || null
      };
    }
  };

  // Function to merge stored data with Firestore data
  const mergeUserData = (storedData, firestoreData) => {
    if (!storedData) return firestoreData;
    if (!firestoreData) return storedData;

    // Merge the data, prioritizing stored data for user profile fields
    const mergedData = {
      ...firestoreData, // Start with Firestore data
      ...storedData,    // Override with stored data
      // But ensure we have the latest Firebase auth info
      uid: firestoreData.uid,
      email: firestoreData.email,
      displayName: firestoreData.displayName,
      // Only use stored data for profile fields if Firestore data is empty
      firstName: firestoreData.firstName || storedData.firstName || "",
      lastName: firestoreData.lastName || storedData.lastName || "",
      number: firestoreData.number || storedData.number || "",
      photo: firestoreData.photo || storedData.photo || null,
    };

    return mergedData;
  };

  // Function to refresh user data
  const refreshUserData = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        // Get current stored data
        const storedUser = await AsyncStorage.getItem('userData');
        const storedData = storedUser ? JSON.parse(storedUser) : null;
        
        // Fetch fresh data from Firestore
        const firestoreData = await fetchUserData(currentUser);
        
        // Merge the data
        const mergedUserData = mergeUserData(storedData, firestoreData);
        
        await AsyncStorage.setItem('userData', JSON.stringify(mergedUserData));
        setUser(mergedUserData);
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  };

  useEffect(() => {
    let storedUserData = null;

    // First try to get stored auth state
    const checkStoredAuth = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('userData');
        console.log('AuthContext - Stored user data:', storedUser);
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          console.log('AuthContext - Parsed user data:', parsedUser);
          console.log('AuthContext - firstName from stored data:', parsedUser.firstName);
          storedUserData = parsedUser;
          // Set user immediately with stored data for faster UI response
          setUser(parsedUser);
        }
      } catch (error) {
        console.error('Error reading stored auth:', error);
      }
    };

    checkStoredAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('AuthContext - Auth state changed:', firebaseUser ? 'User logged in' : 'User logged out');
      try {
        if (firebaseUser) {
          console.log('AuthContext - Firebase user:', firebaseUser.uid);
          // Fetch complete user data from Firestore
          const firestoreData = await fetchUserData(firebaseUser);
          console.log('AuthContext - Fetched user data from Firestore:', firestoreData);
          console.log('AuthContext - firstName from Firestore:', firestoreData.firstName);
          
          // Merge stored data with Firestore data
          const mergedUserData = mergeUserData(storedUserData, firestoreData);
          console.log('AuthContext - Merged user data:', mergedUserData);
          
          await AsyncStorage.setItem('userData', JSON.stringify(mergedUserData));
          setUser(mergedUserData);
        } else {
          console.log('AuthContext - No Firebase user, clearing stored data');
          await AsyncStorage.removeItem('userData');
          setUser(null);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setUser(null);
      } finally {
        // Add a small delay to ensure everything is properly set
        setTimeout(() => {
          setLoading(false);
        }, 500);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Context value
  const value = {
    user,
    loading,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 