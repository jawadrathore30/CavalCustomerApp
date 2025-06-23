import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { 
  signInWithEmailAndPassword,
  signInWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import CavalLogo from "../assets/Caval_Logo-removebg-preview.png";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, firestore } from "../firebase.config";
import { LinearGradient } from "expo-linear-gradient";
import CustomPhoneInput from "./CustomPhoneInput";
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { firebaseConfig } from '../firebase.config';

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [loginMethod, setLoginMethod] = useState("phone"); // Default to 'phone' for Téléphone tab
  const [isDarkMode, setIsDarkMode] = useState(Platform.OS === 'android' ? true : false); // Default to dark mode for Android
  const navigation = useNavigation();
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const phoneInput = useRef(null);
  const recaptchaVerifier = useRef(null);

  // Set up reCAPTCHA verifier
  useEffect(() => {
    if (Platform.OS === 'web') {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
          console.log('reCAPTCHA verified');
        },
        'expired-callback': () => {
          // Response expired. Ask user to solve reCAPTCHA again.
          console.log('reCAPTCHA expired');
          Alert.alert('Error', 'reCAPTCHA verification expired. Please try again.');
        }
      });
    }
  }, []);

  // Load theme preference on component mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem("themePreference");
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === "dark");
      } else {
        // If no saved preference, use platform-specific default
        setIsDarkMode(Platform.OS === 'android' ? true : false);
      }
    } catch (error) {
      console.log("Error loading theme preference:", error);
      // On error, fallback to platform-specific default
      setIsDarkMode(Platform.OS === 'android' ? true : false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem("themePreference", newTheme ? "dark" : "light");
    } catch (error) {
      console.log("Error saving theme preference:", error);
    }
  };

  const handleLogin = async () => {
    if (loginMethod === "email") {
      try {
        setLoading(true);
        setError('');
        
        if (!email || !password) {
          setError('Veuillez remplir tous les champs');
          setLoading(false);
          return;
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Fetch complete user data from Firestore
        const userRef = doc(firestore, 'Customers', user.uid);
        const userDoc = await getDoc(userRef);
        
        let userData;
        if (userDoc.exists()) {
          const firestoreData = userDoc.data();
          userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
            refreshToken: user.refreshToken,
            tokenTimestamp: Date.now(),
            provider: 'email',
            isAuthenticated: true,
            // Include Firestore data
            firstName: firestoreData.firstName || user.displayName?.split(' ')[0] || "",
            lastName: firestoreData.lastName || user.displayName?.split(' ').slice(1).join(' ') || "",
            number: firestoreData.number || "",
            photo: firestoreData.photo || user.photoURL || null,
            ...firestoreData
          };
        } else {
          // Create user document in Firestore
          const defaultUserData = {
            email: user.email,
            firstName: user.displayName?.split(' ')[0] || "",
            lastName: user.displayName?.split(' ').slice(1).join(' ') || "",
            photo: user.photoURL || null,
            lastLogin: serverTimestamp(),
            loginMethod: 'email',
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            authProvider: 'email'
          };
          
          await setDoc(userRef, defaultUserData);
          
          userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
            refreshToken: user.refreshToken,
            tokenTimestamp: Date.now(),
            provider: 'email',
            isAuthenticated: true,
            ...defaultUserData
          };
        }
        
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        
        setLoading(false);
        navigation.navigate("HomeTabs");
      } catch (error) {
        setLoading(false);
        console.log(error.message);
        let errorMessage = "Une erreur est survenue. Veuillez réessayer.";
        
        if (error.code === "auth/invalid-email") {
          errorMessage = "Adresse email invalide.";
        } else if (error.code === "auth/user-not-found") {
          errorMessage = "Aucun compte trouvé avec cette adresse email.";
        } else if (error.code === "auth/wrong-password") {
          errorMessage = "Mot de passe incorrect.";
        }
        
        Alert.alert("Erreur de connexion", errorMessage);
      }
    } else if (loginMethod === "phone") {
      if (showVerification) {
        verifyCode();
      } else {
        sendVerificationCode();
      }
    }
  };

  const sendVerificationCode = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!phoneNumber || phoneNumber.length < 8) {
        setError('Veuillez entrer un numéro de téléphone valide');
        setLoading(false);
        return;
      }

      // Format phone number to E.164 format
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      
      // Use Firebase's built-in phone auth
      const phoneProvider = new PhoneAuthProvider(auth);
      
      let verId;
      if (Platform.OS === 'web') {
        // For web platform, use reCAPTCHA verifier
        if (!window.recaptchaVerifier) {
          setError('Erreur de configuration reCAPTCHA. Veuillez réessayer.');
          setLoading(false);
          return;
        }
        verId = await phoneProvider.verifyPhoneNumber(formattedPhone, window.recaptchaVerifier);
      } else {
        // For mobile platforms, use expo-firebase-recaptcha
        if (!recaptchaVerifier.current) {
          setError('Erreur de configuration reCAPTCHA. Veuillez réessayer.');
          setLoading(false);
          return;
        }
        verId = await phoneProvider.verifyPhoneNumber(formattedPhone, recaptchaVerifier.current);
      }
      
      setVerificationId(verId);
      setShowVerification(true);
      
      // Alert the user that the code has been sent
      Alert.alert(
        "Code envoyé",
        `Un code de vérification a été envoyé au numéro ${formattedPhone}. Veuillez l'entrer ci-dessous.`
      );
    } catch (err) {
      console.error('Error sending verification code:', err);
      if (err.code === 'auth/invalid-phone-number') {
        setError('Numéro de téléphone invalide. Veuillez vérifier et réessayer.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Trop de tentatives. Veuillez réessayer plus tard.');
      } else if (err.code === 'auth/captcha-check-failed') {
        setError('Vérification reCAPTCHA échouée. Veuillez réessayer.');
        if (Platform.OS === 'web' && window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': () => console.log('reCAPTCHA verified'),
            'expired-callback': () => console.log('reCAPTCHA expired')
          });
        }
      } else {
        setError(err.message || 'Échec de l\'envoi du code de vérification');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!verificationCode || verificationCode.length !== 6) {
        setError('Veuillez entrer un code de vérification valide');
        setLoading(false);
        return;
      }
      
      console.log("Attempting to verify code:", verificationCode);
      
      // For development mode, allow any 6-digit code when using dev verification ID
      if (__DEV__ && verificationId === "dev-verification-id") {
        console.log("Development mode: Simulating successful verification");
        
        // Create a mock user for dev testing
        const mockUserId = "dev-user-" + Date.now();
        
        // Create or update user document in Firestore with "number" field
        const userRef = doc(firestore, 'Customers', mockUserId);
        await setDoc(userRef, {
          number: phoneNumber, // Store as "number" instead of "phoneNumber"
          firstName: fname || '',
          lastName: lname || '',
          lastLogin: serverTimestamp(),
          loginMethod: 'phone',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          authProvider: 'phone'
        });
        
        // Store user data in a consistent format for all auth methods
        const userData = {
          uid: mockUserId,
          number: phoneNumber, // Store as "number" instead of "phoneNumber"
          firstName: fname || '',
          lastName: lname || '',
          loginMethod: 'phone',
          tokenTimestamp: Date.now(),
          isAuthenticated: true,
          refreshToken: 'dev-refresh-token-' + Date.now()
        };
        
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        await AsyncStorage.setItem('userCredentials', JSON.stringify(userData));
        
        setLoading(false);
        setShowVerification(false);
        setVerificationCode('');
        setVerificationId('');
        
        navigation.navigate("HomeTabs");
        return;
      }
      
      // Create credential with verification code
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      
      // Sign in with credential
      const userCredential = await signInWithCredential(auth, credential);
      console.log("User signed in successfully:", userCredential.user.uid);
      
      // Check if user document exists in Firestore
      const userRef = doc(firestore, 'Customers', userCredential.user.uid);
      const userDoc = await getDoc(userRef);
      
      const userPhoneNumber = userCredential.user.phoneNumber || phoneNumber;
      
      if (!userDoc.exists()) {
        // Create new user document if it doesn't exist with "number" field
        await setDoc(userRef, {
          number: userPhoneNumber, // Store as "number" instead of "phoneNumber"
          firstName: fname || '',
          lastName: lname || '',
          lastLogin: serverTimestamp(),
          loginMethod: 'phone',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          authProvider: 'phone'
        });
        console.log("Created new user document in Firestore");
      } else {
        // Update existing user document with "number" field
        await updateDoc(userRef, {
          lastLogin: serverTimestamp(),
          updatedAt: serverTimestamp(),
          number: userPhoneNumber, // Store as "number" instead of "phoneNumber"
          firstName: fname || userDoc.data().firstName || '',
          lastName: lname || userDoc.data().lastName || ''
        });
        console.log("Updated existing user document in Firestore");
      }
      
      // Store user data in a consistent format for all auth methods
      const userData = {
        uid: userCredential.user.uid,
        number: userPhoneNumber, // Store as "number" instead of "phoneNumber"
        firstName: fname || '',
        lastName: lname || '',
        loginMethod: 'phone',
        tokenTimestamp: Date.now(),
        refreshToken: userCredential.user.refreshToken,
        isAuthenticated: true
      };
      
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await AsyncStorage.setItem('userCredentials', JSON.stringify(userData));
      
      setLoading(false);
      setShowVerification(false);
      setVerificationCode('');
      setVerificationId('');
      
      navigation.navigate("HomeTabs");
    } catch (err) {
      console.error('Error verifying code:', err);
      setLoading(false);
      
      if (err.code === 'auth/invalid-verification-code') {
        setError('Code de vérification invalide. Veuillez vérifier et réessayer.');
      } else if (err.code === 'auth/code-expired') {
        setError('Le code de vérification a expiré. Veuillez demander un nouveau code.');
        setShowVerification(false);
        setVerificationCode('');
        setVerificationId('');
      } else if (err.code === 'auth/invalid-verification-id') {
        setError('Session de vérification invalide. Veuillez recommencer le processus.');
        setShowVerification(false);
        setVerificationCode('');
        setVerificationId('');
      } else {
        setError(err.message || 'Échec de la vérification du code');
      }
    }
  };

  const resendVerificationCode = () => {
    setShowVerification(false);
    setVerificationCode('');
    // Small delay before sending again
    setTimeout(() => {
      sendVerificationCode();
    }, 500);
  };

  return (
    <LinearGradient
      colors={isDarkMode ? ['#121212', '#1a1a1a'] : ['#ffffff', '#f0f0f0']}
      style={[styles.container, { backgroundColor: isDarkMode ? '#121212' : '#ffffff', overflow: 'visible' }]}
    >
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      <TouchableOpacity 
        style={styles.themeToggle} 
        onPress={toggleTheme}
        accessibilityLabel={isDarkMode ? "Activer le mode clair" : "Activer le mode sombre"}
      >
        <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color="#fff" />
      </TouchableOpacity>

      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
      />

      <ScrollView contentContainerStyle={[styles.scrollContainer, { overflow: 'visible' }] }>
        <Image 
          style={styles.logo} 
          source={CavalLogo} 
          resizeMode="contain"
        />

        {/* Welcome Header */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Bienvenue !</Text>
          <Text style={styles.welcomeSubtitle}>
            Connectez-vous pour accéder à vos services
          </Text>
        </View>

        <View style={styles.card}>
          {/* Login Method Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[
                styles.tab, 
                loginMethod === "phone" && styles.activeTab
              ]} 
              onPress={() => {
                setLoginMethod("phone");
                setShowVerification(false);
                setError('');
              }}
            >
              <Ionicons 
                name="phone-portrait" 
                size={20} 
                color={loginMethod === "phone" ? "#ff9f43" : "#aaa"} 
                style={styles.tabIcon}
              />
              <Text style={[
                styles.tabText, 
                loginMethod === "phone" && styles.activeTabText
              ]}>Téléphone</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.tab, 
                loginMethod === "email" && styles.activeTab
              ]} 
              onPress={() => {
                setLoginMethod("email");
                setShowVerification(false);
                setError('');
              }}
            >
              <Ionicons 
                name="mail" 
                size={20} 
                color={loginMethod === "email" ? "#ff9f43" : "#aaa"} 
                style={styles.tabIcon}
              />
              <Text style={[
                styles.tabText, 
                loginMethod === "email" && styles.activeTabText
              ]}>Email</Text>
            </TouchableOpacity>
          </View>

          {/* Email Login Form */}
          {loginMethod === "email" && (
            <>
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color="#aaa" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Adresse email"
                  placeholderTextColor="#777"
                  onChangeText={setEmail}
                  value={email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#aaa" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe"
                  placeholderTextColor="#777"
                  onChangeText={setPassword}
                  value={password}
                  secureTextEntry
                />
              </View>
            </>
          )}

          {/* Phone Login Form */}
          {loginMethod === "phone" && (
            <>
              {!showVerification ? (
                <>
                  <View style={styles.nameContainer}>
                    <View style={[styles.inputContainer, styles.halfInput]}>
                      <Ionicons name="person" size={20} color="#aaa" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Prénom"
                        placeholderTextColor="#777"
                        onChangeText={setFname}
                        value={fname}
                      />
                    </View>
                    <View style={[styles.inputContainer, styles.halfInput]}>
                      <Ionicons name="person" size={20} color="#aaa" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Nom"
                        placeholderTextColor="#777"
                        onChangeText={setLname}
                        value={lname}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <View style={{ zIndex: 9999, elevation: 20, overflow: 'visible' }}>
                      <CustomPhoneInput
                        value={phoneNumber}
                        onChangeFormattedText={(text) => {
                          setPhoneNumber(text);
                        }}
                        containerStyle={styles.phoneInputContainer}
                        textContainerStyle={styles.phoneTextContainer}
                        textInputStyle={styles.phoneInputText}
                        codeTextStyle={styles.phoneCodeText}
                        defaultCode="DJ"
                        placeholder="Numéro de téléphone"
                      />
                    </View>
                  </View>
                  <Text style={styles.infoText}>
                    Vous n'avez pas besoin de créer un compte si vous vous connectez avec votre numéro de téléphone.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.verificationContainer}>
                    <Ionicons name="shield-checkmark" size={40} color="#ff9f43" style={styles.verificationIcon} />
                    <Text style={styles.verificationTitle}>Vérification</Text>
                    <Text style={styles.verificationSubtitle}>
                      Entrez le code envoyé à votre téléphone
                    </Text>
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Ionicons name="keypad" size={20} color="#aaa" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Code de vérification"
                      placeholderTextColor="#777"
                      onChangeText={setVerificationCode}
                      value={verificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.resendButton} 
                    onPress={resendVerificationCode}
                    disabled={loading}
                  >
                    <Text style={styles.resendButtonText}>Renvoyer le code</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" />
                <Text style={[styles.buttonText, {marginLeft: 10}]}>Chargement...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>
                {loginMethod === "phone" && showVerification ? "Vérifier" : 
                 loginMethod === "phone" ? "Envoyer le code" : "Se connecter"}
              </Text>
            )}
          </TouchableOpacity>

          {loginMethod === "email" && (
            <TouchableOpacity 
              onPress={() => navigation.navigate("ForgotPasswordScreen")}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Registration Link - Moved between card and features */}
        <Text
          style={styles.linkText}
          onPress={() => navigation.navigate("RegisterScreen")}
        >
          Vous n'avez pas de compte ? <Text style={styles.linkTextHighlight}>Inscrivez-vous ici</Text>
        </Text>

        {/* Features Section */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Pourquoi choisir Caval ?</Text>
          <View style={styles.featuresGrid}>
            <View style={styles.featureItem}>
              <Ionicons name="flash" size={24} color="#ff9f43" />
              <Text style={styles.featureText}>Rapide</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={24} color="#ff9f43" />
              <Text style={styles.featureText}>Sécurisé</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="location" size={24} color="#ff9f43" />
              <Text style={styles.featureText}>Précis</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="heart" size={24} color="#ff9f43" />
              <Text style={styles.featureText}>Fiable</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Default dark background
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "flex-start",
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 80, // Increased top padding further
    backgroundColor: 'transparent',
  },
  themeToggle: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    right: 20,
    padding: 8,
    borderRadius: 20,
    zIndex: 999,
  },
  logo: {
    width: 260,
    height: undefined,
    aspectRatio: 1,
    alignSelf: "center",
    marginBottom: Platform.OS === 'android' ? -10 : 5, // Reduced negative margin to bring content up
  },
  welcomeContainer: {
    alignItems: "center",
    marginBottom: 35,
    paddingHorizontal: 20,
    marginTop: -40, // Much larger negative margin to raise significantly higher
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#bbb",
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 8,
    marginHorizontal: 6,
    marginTop: Platform.OS === 'android' ? -20 : 10, // Adjusted margin to work with raised welcome section
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabIcon: {
    marginRight: 8,
  },
  activeTab: {
    borderBottomColor: "#ff9f43",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#aaa",
  },
  activeTabText: {
    color: "#ff9f43",
    fontWeight: "700",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  inputIcon: {
    marginHorizontal: 15,
  },
  input: {
    flex: 1,
    height: 55,
    fontSize: 16,
    color: "#fff",
    paddingRight: 15,
  },
  errorText: {
    color: "#ff5252",
    marginBottom: 16,
    textAlign: "center",
    fontSize: 14,
  },
  button: {
    backgroundColor: "#ff9f43",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#ff9f43",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    textAlign: "center",
    marginTop: 15,
    marginBottom: 20,
    fontSize: 16,
    color: "#aaa",
  },
  linkTextHighlight: {
    color: "#ff9f43",
    fontWeight: "600",
  },
  forgotText: {
    color: "#ff9f43",
    textAlign: "center",
    marginTop: 15,
    fontSize: 16,
    fontWeight: "500",
  },
  nameContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  halfInput: {
    width: "48%",
  },
  phoneInputContainer: {
    width: "100%",
    height: 55,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#333",
    overflow: 'hidden',
  },
  phoneTextContainer: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    paddingVertical: 0,
    height: 55,
  },
  phoneInputText: {
    color: "#fff",
    fontSize: 16,
    height: 55,
  },
  phoneCodeText: {
    color: "#aaa",
    fontSize: 14,
    height: 55,
    lineHeight: 55,
  },
  resendButton: {
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 15,
  },
  resendButtonText: {
    color: "#ff9f43",
    fontSize: 16,
    fontWeight: "500",
  },
  infoText: {
    color: '#aaa',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 18,
  },
  verificationContainer: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 15,
  },
  verificationIcon: {
    marginBottom: 10,
  },
  verificationTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 5,
  },
  verificationSubtitle: {
    fontSize: 14,
    color: "#bbb",
    textAlign: "center",
    lineHeight: 20,
  },
  featuresContainer: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 6,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 5,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    marginBottom: 15,
  },
  featuresGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
  },
  featureItem: {
    alignItems: "center",
    width: "25%",
    paddingVertical: 10,
  },
  featureText: {
    fontSize: 12,
    color: "#bbb",
    marginTop: 5,
    textAlign: "center",
    fontWeight: "500",
  },
});

export default LoginScreen;