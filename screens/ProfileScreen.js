import React, { useEffect, useState, useContext } from "react";
import { auth, firestore } from "../firebase.config";
import { doc, getDoc, updateDoc, setDoc, collection, getDocs } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  StatusBar,
  Dimensions,
  SafeAreaView,
  useColorScheme,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import CavalLogo from "../assets/Caval_Logo-removebg-preview.png";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ProfilePicture from '../components/ProfilePicture';
import { uploadImage, generateImagePath } from '../utils/storage';
import { useAuth } from '../context/AuthContext';

// Create ThemeContext
const ThemeContext = React.createContext();

// ThemeProvider component
export const ThemeProvider = ({ children }) => {
  const deviceTheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load theme preference from storage on initial render
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("themePreference");
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === "dark");
        } else {
          // Use device theme as default if no preference is saved
          setIsDarkMode(deviceTheme === "dark");
        }
      } catch (error) {
        console.error("Failed to load theme preference:", error);
      }
    };

    loadThemePreference();
  }, []);

  // Save theme preference when it changes
  useEffect(() => {
    const saveThemePreference = async () => {
      try {
        await AsyncStorage.setItem("themePreference", isDarkMode ? "dark" : "light");
      } catch (error) {
        console.error("Failed to save theme preference:", error);
      }
    };

    saveThemePreference();
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme
export const useTheme = () => useContext(ThemeContext);

const windowWidth = Dimensions.get("window").width;

function Profile() {
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userActivities, setUserActivities] = useState([]);
  const navigation = useNavigation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { refreshUserData } = useAuth();

  // Define theme colors
  const theme = {
    background: isDarkMode ? "#121212" : "#F7F7F7",
    card: isDarkMode ? "#1E1E1E" : "#FFFFFF",
    text: isDarkMode ? "#FFFFFF" : "#333333",
    subtext: isDarkMode ? "#AAAAAA" : "#888888",
    divider: isDarkMode ? "#333333" : "#EEEEEE",
    primaryGradient: isDarkMode ? ["#FF8F00", "#FF6F00"] : ["#FF8F00", "#FF6F00"],
    statusBar: isDarkMode ? "light-content" : "dark-content",
    statusBarColor: isDarkMode ? "#121212" : "#F7F7F7",
    serviceIcon: "#FFFFFF",
    serviceCardBackground: isDarkMode ? "#2A2A2A" : "#FFFFFF",
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Get the current Firebase user
      const user = auth.currentUser;
      if (!user) {
        console.log("No authenticated user found");
        setLoading(false);
        navigation.navigate("LoginScreen");
        return;
      }

      console.log("Fetching data for user:", user.uid);
      
      // Try to get the user document from Firestore
      const docRef = doc(firestore, "Customers", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        console.log("ProfileScreen - User data from Firestore:", userData);
        setUserDetails({
          ...userData,
          email: user.email,
          firstName: userData.firstName || user.displayName?.split(' ')[0] || "",
          lastName: userData.lastName || user.displayName?.split(' ').slice(1).join(' ') || "",
          number: userData.number || user.number || "",
          photo: userData.photo || user.photoURL || null
        });
      } else {
        console.log("No user document found, creating new one");
        // Create a new user document with default values
        const defaultUserData = {
          email: user.email,
          firstName: user.displayName?.split(' ')[0] || "",
          lastName: user.displayName?.split(' ').slice(1).join(' ') || "",
          number: user.number || "",
          photo: user.photoURL || null,
          createdAt: new Date(),
          lastLogin: new Date(),
          authProvider: user.providerData[0]?.providerId || "email"
        };
        
        // Create the document in Firestore
        await setDoc(docRef, defaultUserData);
        
        // Set the user details in state
        setUserDetails(defaultUserData);
      }
      
      // Also refresh the auth context user data
      await refreshUserData();
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Failed to load user data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchUserData();
  }, []);

  // Listen for screen focus to refresh data
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUserData();
    });

    return unsubscribe;
  }, [navigation]);

  const handleProfilePictureChange = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setLoading(true);
        const imageUri = result.assets[0].uri;

        // Get the current authenticated user
        const currentUser = auth.currentUser;
        if (!currentUser) {
          Alert.alert('Error', 'User not authenticated');
          setLoading(false);
          return;
        }

        // Convert the image URI to a blob (required for Firebase Storage)
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // Generate a storage path
        const imagePath = generateImagePath(currentUser.uid, 'profile.jpg');

        // Upload to Firebase Storage
        const downloadURL = await uploadImage(blob, imagePath);

        // Update the user document with the new photo URL (downloadURL)
        const docRef = doc(firestore, "Customers", currentUser.uid);
        await updateDoc(docRef, {
          photo: downloadURL
        });

        // Update local state
        setUserDetails(prev => ({
          ...prev,
          photo: downloadURL
        }));

        // Also refresh the auth context
        await refreshUserData();

        Alert.alert('Success', 'Profile picture updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      await AsyncStorage.removeItem('userData');
      console.log("User logged out successfully!");
      navigation.navigate("LoginScreen");
    } catch (error) {
      console.error("Error logging out:", error.message);
      Alert.alert("Error", error.message, [{ text: "OK" }]);
    }
  };

  const navigateToAccountScreen = () => {
    navigation.navigate("AccountScreen");
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarColor} />
        <LinearGradient
          colors={theme.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loadingLogoBackground}
        >
          <Image source={CavalLogo} style={styles.loadingLogo} />
        </LinearGradient>
        <ActivityIndicator size="large" color="#FF6F00" style={styles.loadingIndicator} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Chargement de votre profil...</Text>
      </View>
    );
  }

  if (!userDetails) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.statusBarColor} />
        <Ionicons name="alert-circle-outline" size={64} color="#FF6F00" />
        <Text style={[styles.errorText, { color: theme.text }]}>Impossible de charger votre profil</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchUserData}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6F00" />
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
        {/* En-tête avec gradient */}
        <LinearGradient
          colors={theme.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <View style={styles.brandContainer}>
              <Image source={CavalLogo} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.headerButton} 
                onPress={() => navigation.navigate("InboxScreen")}
              >
                <Ionicons name="chatbubbles" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
                <Ionicons 
                  name={isDarkMode ? "sunny-outline" : "moon-outline"} 
                  size={24} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity style={styles.profilePicContainer} onPress={handleProfilePictureChange}>
            <ProfilePicture 
              photoUrl={userDetails?.photo}
              size={120}
              style={styles.profilePic}
            />
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>
            {userDetails?.firstName || ''} {userDetails?.lastName || ''}
          </Text>
          <Text style={styles.userEmail}>{userDetails?.email || ''}</Text>
        </LinearGradient>

        {/* Carte d'informations */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <TouchableOpacity style={styles.infoRow} onPress={navigateToAccountScreen}>
            <Ionicons name="call-outline" size={20} color="#FF6F00" />
            <Text style={[styles.infoText, { color: theme.text }]}>
              {userDetails.number || "Ajouter un numéro de téléphone"}
            </Text>
            <Ionicons name="create-outline" size={20} color={theme.subtext} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <TouchableOpacity style={styles.infoRow} onPress={() => navigation.navigate("InboxScreen")}>
            <Ionicons name="chatbubbles-outline" size={20} color="#FF6F00" />
            <Text style={[styles.infoText, { color: theme.text }]}>
              Messages
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* Section des services */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Services</Text>
        </View>

        <View style={styles.servicesGrid}>
          <TouchableOpacity
            style={[styles.serviceCard, { backgroundColor: theme.serviceCardBackground }]}
            onPress={() => navigation.navigate("AccountScreen")}
          >
            <View style={styles.serviceIconContainer}>
              <Ionicons name="person" size={24} color={theme.serviceIcon} />
            </View>
            <Text style={[styles.serviceTitle, { color: theme.text }]}>Compte</Text>
            <Text style={[styles.serviceDescription, { color: theme.subtext }]}>Gérer vos informations personnelles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.serviceCard, { backgroundColor: theme.serviceCardBackground }]}
            onPress={() => navigation.navigate("Activity")}
          >
            <View style={styles.serviceIconContainer}>
              <Ionicons name="time" size={24} color={theme.serviceIcon} />
            </View>
            <Text style={[styles.serviceTitle, { color: theme.text }]}>Historique</Text>
            <Text style={[styles.serviceDescription, { color: theme.subtext }]}>Voir vos courses passées</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.serviceCard, { backgroundColor: theme.serviceCardBackground }]}
            onPress={() => navigation.navigate("PaymentMethodsScreen")}
          >
            <View style={styles.serviceIconContainer}>
              <Ionicons name="card" size={24} color={theme.serviceIcon} />
            </View>
            <Text style={[styles.serviceTitle, { color: theme.text }]}>Paiement</Text>
            <Text style={[styles.serviceDescription, { color: theme.subtext }]}>Gérer vos moyens de paiement</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.serviceCard, { backgroundColor: theme.serviceCardBackground }]}
            onPress={() => navigation.navigate("InboxScreen")}
          >
            <View style={styles.serviceIconContainer}>
              <Ionicons name="chatbubbles" size={24} color={theme.serviceIcon} />
            </View>
            <Text style={[styles.serviceTitle, { color: theme.text }]}>Messages</Text>
            <Text style={[styles.serviceDescription, { color: theme.subtext }]}>Voir vos conversations</Text>
          </TouchableOpacity>
        </View>

        {/* Section d'aide et support */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Aide et Support</Text>
        </View>

        <View style={[styles.supportSection, { backgroundColor: theme.card }]}>
          <TouchableOpacity
            style={[styles.supportButton, { borderBottomColor: theme.divider }]}
            onPress={() => Linking.openURL("https://www.caval.tech/contact")}
          >
            <Ionicons name="mail-outline" size={24} color="#FF6F00" style={styles.supportIcon} />
            <View style={styles.supportTextContainer}>
              <Text style={[styles.supportTitle, { color: theme.text }]}>Contacter le support</Text>
              <Text style={[styles.supportDescription, { color: theme.subtext }]}>Besoin d'aide? Contactez-nous</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.subtext} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.supportButton, { borderBottomColor: theme.divider }]}
            onPress={() => Linking.openURL("https://www.caval.tech/privacy-policy")}
          >
            <Ionicons name="document-text-outline" size={24} color="#FF6F00" style={styles.supportIcon} />
            <View style={styles.supportTextContainer}>
              <Text style={[styles.supportTitle, { color: theme.text }]}>Politique de confidentialité</Text>
              <Text style={[styles.supportDescription, { color: theme.subtext }]}>Consulter nos conditions</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.subtext} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.supportButton, { borderBottomColor: theme.divider }]}
            onPress={() => Linking.openURL("https://www.caval.tech/contact#devis")}
          >
            <Ionicons name="car-sport-outline" size={24} color="#FF6F00" style={styles.supportIcon} />
            <View style={styles.supportTextContainer}>
              <Text style={[styles.supportTitle, { color: theme.text }]}>Devenir chauffeur</Text>
              <Text style={[styles.supportDescription, { color: theme.subtext }]}>Rejoignez notre équipe</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* Bouton de déconnexion */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FFF" style={styles.logoutIcon} />
          <Text style={styles.logoutButtonText}>Déconnexion</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.subtext }]}>CAVAL © {new Date().getFullYear()}</Text>
          <Text style={[styles.versionText, { color: theme.subtext }]}>Version 2.1.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// To use the Profile component with ThemeProvider
export const ProfileWithTheme = () => (
  <ThemeProvider>
    <Profile />
  </ThemeProvider>
);

export default ProfileWithTheme;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingLogoBackground: {
    borderRadius: 20,
    padding: 15,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    marginBottom: 20,
  },
  loadingLogo: {
    width: 140,
    height: 70,
    resizeMode: "contain",
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginVertical: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#FF6F00",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  retryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  brandContainer: {
    height: 50,
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: 100,
    height: 50,
    resizeMode: "contain",
  },
  profilePicContainer: {
    position: "relative",
  },
  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#FFF",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#FF6F00",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
    marginTop: 15,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    textAlign: "center",
  },
  userEmail: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 5,
    textAlign: "center",
  },
  infoCard: {
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    marginTop: -30,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
  },
  divider: {
    height: 1,
    marginVertical: 5,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 30,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  serviceCard: {
    width: (windowWidth - 60) / 2,
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  serviceIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF6F00",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  serviceDescription: {
    fontSize: 12,
    textAlign: "center",
  },
  supportSection: {
    borderRadius: 15,
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: "hidden",
  },
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  supportIcon: {
    marginRight: 15,
  },
  supportTextContainer: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  supportDescription: {
    fontSize: 14,
    marginTop: 3,
  },
  logoutButton: {
    flexDirection: "row",
    backgroundColor: "#FF6F00",
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 15,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6F00",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  logoutIcon: {
    marginRight: 10,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  footerText: {
    fontSize: 14,
    marginBottom: 5,
  },
  versionText: {
    fontSize: 12,
  },
});