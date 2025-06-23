import React, { useEffect, useState, useRef } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Image,
  Animated,
  Text,
  LogBox,
  ActivityIndicator,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase.config";
// import { StripeProvider } from '@stripe/stripe-react-native';
import { getAuth, signInWithCustomToken, signInWithEmailAndPassword } from "firebase/auth"; // Firebase Auth
import firebase from './firebase.config';
import { AuthProvider, useAuth } from './context/AuthContext';

// Add crypto polyfill
import 'react-native-get-random-values';

// Import Screens
import SplashScreen from "./screens/SplashScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreenWithMap from "./screens/HomeScreenWithMap";
import ProfileScreen from "./screens/ProfileScreen";
import ActivityScreen from "./screens/ActivityScreen";
import SettingsScreen from "./screens/SettingsScreen";
import RideOptionsScreen from "./screens/RideOptionsScreen";
import AccountScreen from "./screens/accountScreen";
import WalletScreen from "./screens/WalletScreen";
import ModifyFieldScreen from "./screens/ModifyFieldScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import { PaymentMethodsScreen } from "./screens/PaymentMethodsScreen";
import FindingDriverScreen from "./screens/FindingDriverScreen";
import DriverFoundScreen from "./screens/DriverFoundScreen";
import InboxScreen from './screens/InboxScreen';
import CustomerInboxScreen from './screens/CustomerInboxScreen';
import AnimatedLoginScreen from "./screens/AnimatedLoginScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Add this at the top level, before the App component
LogBox.ignoreLogs(['Warning: ...']); // Ignore non-critical warnings

// Bottom Tab Navigator (Home, Activity, Profile)
function HomeTabs() {
  const { user } = useAuth();
  const userName = user?.firstName || user?.displayName || "User";
  
  console.log('App.js - User from auth context:', user);
  console.log('App.js - userName being passed to HomeScreenWithMap:', userName);
  console.log('App.js - user.firstName:', user?.firstName);
  console.log('App.js - user.displayName:', user?.displayName);
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Activity") {
            iconName = focused ? "time" : "time-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }
          return (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? 'rgba(255, 159, 67, 0.15)' : 'transparent',
              borderRadius: 12,
              padding: 6,
              width: 40,
              height: 40
            }}>
              <Ionicons name={iconName} size={22} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: "#ff9f43",
        tabBarInactiveTintColor: "#888888",
        tabBarStyle: {
          backgroundColor: "#1e1e1e",
          borderTopColor: "transparent",
          position: Platform.OS === 'android' ? "relative" : "absolute",
          bottom: Platform.OS === 'android' ? 40 : 25,
          left: 20,
          right: 20,
          height: 65,
          paddingTop: 5,
          paddingBottom: 8,
          borderRadius: 20,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 5,
          },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabel: ({ focused, color }) => (
          <Text style={{
            color: color,
            fontSize: 12,
            fontWeight: focused ? 'bold' : 'normal',
            marginTop: 2,
            marginBottom: 4
          }}>
            {route.name}
          </Text>
        ),
        tabBarItemStyle: {
          paddingTop: 5,
          height: 55,
        },
        headerShown: false
      })}
    >
      <Tab.Screen 
        name="Home" 
      >
        {() => <HomeScreenWithMap 
          userName={userName} 
          rides={[]} 
          bookings={[]}
          notifications={[]}
          messages={[]}
        />}
      </Tab.Screen>
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
      />
    </Tab.Navigator>
  );
}

// Create a wrapper component to use the auth context
const AppContent = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff9f43" />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        colors: {
          background: '#121212',
          card: '#1e1e1e',
          text: '#ffffff',
          border: '#333333',
          primary: '#ff9f43',
        },
        dark: true,
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#121212' },
          animationEnabled: false
        }}
        initialRouteName={user ? "HomeTabs" : "LoginScreen"}
      >
        {/* Authentication Screens */}
        <Stack.Screen
          name="LoginScreen"
          component={AnimatedLoginScreen}
        />
        <Stack.Screen
          name="RegisterScreen"
          component={RegisterScreen}
        />
        <Stack.Screen
          name="ForgotPasswordScreen"
          component={ForgotPasswordScreen}
        />

        {/* Main App Screens */}
        <Stack.Screen
          name="HomeTabs"
          component={HomeTabs}
        />
        <Stack.Screen
          name="RideOptionsScreen"
          component={RideOptionsScreen}
        />
        <Stack.Screen
          name="FindingDriverScreen"
          component={FindingDriverScreen}
        />
        <Stack.Screen
          name="DriverFoundScreen"
          component={DriverFoundScreen}
        />
        <Stack.Screen
          name="SettingsScreen"
          component={SettingsScreen}
        />
        <Stack.Screen
          name="AccountScreen"
          component={AccountScreen}
        />
        <Stack.Screen
          name="WalletScreen"
          component={WalletScreen}
        />
        <Stack.Screen
          name="ModifyFieldScreen"
          component={ModifyFieldScreen}
        />
        <Stack.Screen
          name="PaymentMethodsScreen"
          component={PaymentMethodsScreen}
        />
        <Stack.Screen
          name="InboxScreen"
          component={InboxScreen}
        />
        <Stack.Screen
          name="CustomerInboxScreen"
          component={CustomerInboxScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <View style={styles.appContainer}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: "#121212",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
  },
});