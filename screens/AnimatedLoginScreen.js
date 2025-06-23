import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  StatusBar,
  Alert,
  ScrollView,
  Dimensions,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from 'expo-blur';
import CavalLogo from "../assets/Caval_Logo-removebg-preview.png";
import { signInWithEmailAndPassword, signInWithCredential, PhoneAuthProvider, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, firestore } from "../firebase.config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CustomPhoneInput from "./CustomPhoneInput";
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { firebaseConfig } from '../firebase.config';
import * as Crypto from 'expo-crypto';

const { width, height } = Dimensions.get('window');

const STEPS = {
  WELCOME: 0,
  USERNAME: 1,
  LOGIN: 2,
  VERIFY: 3,
};

export default function AnimatedLoginScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState(STEPS.WELCOME);
  const [username, setUsername] = useState("");
  const [loginMethod, setLoginMethod] = useState("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const recaptchaVerifier = useRef(null);
  
  // Enhanced animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const backgroundShift = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Floating particles animation
  const particleAnims = useRef(
    Array.from({ length: 8 }, () => ({
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0.3),
      scale: new Animated.Value(0.5),
    }))
  ).current;

  useEffect(() => {
    // Start background animations
    startBackgroundAnimations();
    startParticleAnimations();
    
    // Logo entrance animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.elastic(1),
        useNativeDriver: true,
      }),
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();
    
    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: (step + 1) / 4,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [step]);

  const startBackgroundAnimations = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundShift, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(backgroundShift, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startParticleAnimations = () => {
    particleAnims.forEach((particle, index) => {
      const delay = index * 800;
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(particle.translateY, {
              toValue: -height * 0.8,
              duration: 4000 + Math.random() * 2000,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: 4000 + Math.random() * 2000,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(particle.translateY, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(particle.opacity, {
            toValue: 0.3,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  };

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -5,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pulseAnimation = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.05,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateStep = (nextStep) => {
    // Update progress
    Animated.timing(progressAnim, {
      toValue: (nextStep + 1) / 4,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    // Smooth step transition
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(50);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNextFromWelcome = () => {
    pulseAnimation();
    setTimeout(() => animateStep(STEPS.USERNAME), 100);
  };
  
  const handleNextFromUsername = () => {
    if (!username.trim()) {
      shakeAnimation();
      return;
    }
    pulseAnimation();
    setTimeout(() => animateStep(STEPS.LOGIN), 100);
  };

  const handleLogin = async () => {
    setError("");
    if (loginMethod === "phone") {
      if (showVerification) {
        verifyCode();
      } else {
        sendVerificationCode();
      }
    } else {
      if (!email || !password) {
        setError("Veuillez remplir tous les champs");
        shakeAnimation();
        return;
      }
      try {
        setLoading(true);
        let userCredential;
        try {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
          if (error.code === "auth/email-already-in-use") {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
          } else {
            throw error;
          }
        }
        const userRef = doc(firestore, 'Customers', userCredential.user.uid);
        const userDoc = await getDoc(userRef);
        const userPhoneNumber = userCredential.user.phoneNumber || phoneNumber;
        if (!userDoc.exists()) {
          await setDoc(userRef, {
            number: userPhoneNumber,
            firstName: username,
            lastName: '',
            lastLogin: serverTimestamp(),
            loginMethod: 'email',
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            authProvider: 'email'
          });
        } else {
          await updateDoc(userRef, {
            lastLogin: serverTimestamp(),
            updatedAt: serverTimestamp(),
            number: userPhoneNumber,
            firstName: username,
          });
        }
        const userData = {
          uid: userCredential.user.uid,
          number: userPhoneNumber,
          firstName: username,
          loginMethod: 'email',
          tokenTimestamp: Date.now(),
          refreshToken: userCredential.user.refreshToken,
          isAuthenticated: true
        };
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        setLoading(false);
        navigation.navigate("HomeTabs");
      } catch (error) {
        setLoading(false);
        let errorMessage = "Une erreur est survenue. Veuillez réessayer.";
        if (error.code === "auth/invalid-email") {
          errorMessage = "Adresse email invalide.";
        } else if (error.code === "auth/weak-password") {
          errorMessage = "Le mot de passe doit contenir au moins 6 caractères.";
        } else if (error.code === "auth/wrong-password") {
          errorMessage = "Mot de passe incorrect.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        setError(errorMessage);
        shakeAnimation();
      }
    }
  };

  const sendVerificationCode = async () => {
    try {
      setLoading(true);
      setError("");
      if (!phoneNumber || phoneNumber.length < 8) {
        setError("Veuillez entrer un numéro de téléphone valide");
        shakeAnimation();
        setLoading(false);
        return;
      }
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      const phoneProvider = new PhoneAuthProvider(auth);
      let verId;
      if (Platform.OS === 'web') {
        if (!window.recaptchaVerifier) {
          setError('Erreur de configuration reCAPTCHA. Veuillez réessayer.');
          setLoading(false);
          return;
        }
        verId = await phoneProvider.verifyPhoneNumber(formattedPhone, window.recaptchaVerifier);
      } else {
        if (!recaptchaVerifier.current) {
          setError('Erreur de configuration reCAPTCHA. Veuillez réessayer.');
          setLoading(false);
          return;
        }
        verId = await phoneProvider.verifyPhoneNumber(formattedPhone, recaptchaVerifier.current);
      }
      setVerificationId(verId);
      setShowVerification(true);
      animateStep(STEPS.VERIFY);
      Alert.alert(
        "Code envoyé",
        `Un code de vérification a été envoyé au numéro ${formattedPhone}. Veuillez l'entrer ci-dessous.`
      );
    } catch (err) {
      setError(err.message || 'Échec de l\'envoi du code de vérification');
      shakeAnimation();
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    try {
      setLoading(true);
      setError("");
      if (!verificationCode || verificationCode.length !== 6) {
        setError("Veuillez entrer un code de vérification valide");
        shakeAnimation();
        setLoading(false);
        return;
      }
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      const userCredential = await signInWithCredential(auth, credential);
      const userRef = doc(firestore, 'Customers', userCredential.user.uid);
      const userDoc = await getDoc(userRef);
      const userPhoneNumber = userCredential.user.phoneNumber || phoneNumber;
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          number: userPhoneNumber,
          firstName: username,
          lastName: '',
          lastLogin: serverTimestamp(),
          loginMethod: 'phone',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          authProvider: 'phone'
        });
      } else {
        await updateDoc(userRef, {
          lastLogin: serverTimestamp(),
          updatedAt: serverTimestamp(),
          number: userPhoneNumber,
          firstName: username,
        });
      }
      const userData = {
        uid: userCredential.user.uid,
        number: userPhoneNumber,
        firstName: username,
        loginMethod: 'phone',
        tokenTimestamp: Date.now(),
        refreshToken: userCredential.user.refreshToken,
        isAuthenticated: true
      };
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setLoading(false);
      navigation.navigate("HomeTabs");
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Échec de la vérification du code');
      shakeAnimation();
    }
  };

  const renderFloatingParticles = () => {
    return particleAnims.map((particle, index) => (
      <Animated.View
        key={index}
        style={[
          styles.particle,
          {
            left: Math.random() * width,
            opacity: particle.opacity,
            transform: [
              { translateY: particle.translateY },
              { scale: particle.scale }
            ],
          },
        ]}
      />
    ));
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        {step + 1} / 4
      </Text>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case STEPS.WELCOME:
        return (
          <Animated.View 
            style={[
              styles.stepContainer, 
              { 
                opacity: fadeAnim, 
                transform: [
                  { translateY: slideAnim },
                ] 
              }
            ]}
          > 
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            <Image 
              source={CavalLogo} 
              style={styles.bigLogo}
              resizeMode="contain" 
            />
            <Text style={styles.welcomeTitle}>Bienvenue sur Caval</Text>
            <Text style={styles.welcomeSubtitle}>
              Votre compagnon de mobilité moderne
            </Text>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleNextFromWelcome} 
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#ff9f43', '#ff7675']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Commencer</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        );
        
      case STEPS.USERNAME:
        return (
          <Animated.View 
            style={[
              styles.stepContainer, 
              { 
                opacity: fadeAnim, 
                transform: [
                  { translateY: slideAnim },
                  { translateX: shakeAnim }
                ] 
              }
            ]}
          > 
            <View style={styles.iconContainer}>
              <Ionicons name="person-outline" size={40} color="#ff9f43" />
            </View>
            <Text style={styles.stepTitle}>Quel est votre prénom ?</Text>
            <Text style={styles.stepSubtitle}>
              Personnalisez votre expérience
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.modernInput}
                placeholder="Entrez votre prénom"
                placeholderTextColor="#666"
                value={username}
                onChangeText={setUsername}
                autoFocus
              />
            </View>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleNextFromUsername} 
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#ff9f43', '#ff7675']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Continuer</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        );
        
      case STEPS.LOGIN:
        return (
          <Animated.View 
            style={[
              styles.stepContainer, 
              { 
                opacity: fadeAnim, 
                transform: [
                  { translateY: slideAnim },
                  { translateX: shakeAnim }
                ] 
              }
            ]}
          > 
            <View style={styles.iconContainer}>
              <Ionicons name="log-in-outline" size={40} color="#ff9f43" />
            </View>
            <Text style={styles.stepTitle}>Connectez-vous</Text>
            <Text style={styles.stepSubtitle}>
              Choisissez votre méthode de connexion
            </Text>
            
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, loginMethod === "phone" && styles.activeTab]}
                onPress={() => setLoginMethod("phone")}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="call" 
                  size={18} 
                  color={loginMethod === "phone" ? "#fff" : "#666"} 
                />
                <Text style={[styles.tabText, loginMethod === "phone" && styles.activeTabText]}>
                  Téléphone
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, loginMethod === "email" && styles.activeTab]}
                onPress={() => setLoginMethod("email")}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="mail" 
                  size={18} 
                  color={loginMethod === "email" ? "#fff" : "#666"} 
                />
                <Text style={[styles.tabText, loginMethod === "email" && styles.activeTabText]}>
                  Email
                </Text>
              </TouchableOpacity>
            </View>
            
            {loginMethod === "phone" ? (
              <>
                <View style={styles.inputContainer}>
                  <Ionicons name="call" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernInput}
                    placeholder="Numéro de téléphone (ex: +253 77 12 34 56)"
                    placeholderTextColor="#666"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity 
                  style={[styles.primaryButton, loading && styles.disabledButton]} 
                  onPress={handleLogin} 
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={loading ? ['#666', '#555'] : ['#ff9f43', '#ff7675']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Envoyer le code</Text>
                        <Ionicons name="send" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.infoBanner}>
                  <Ionicons name="information-circle" size={18} color="#ff9f43" />
                  <Text style={styles.infoBannerText}>
                    Pas besoin de s'inscrire, c'est automatique !
                  </Text>
                </View>
                
                <View style={styles.inputContainer}>
                  <Ionicons name="mail" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernInput}
                    placeholder="Adresse email"
                    placeholderTextColor="#666"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernInput}
                    placeholder="Mot de passe"
                    placeholderTextColor="#666"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity 
                  style={[styles.primaryButton, loading && styles.disabledButton]} 
                  onPress={handleLogin} 
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={loading ? ['#666', '#555'] : ['#ff9f43', '#ff7675']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Se connecter</Text>
                        <Ionicons name="log-in" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
            
            {error ? (
              <Animated.View style={[styles.errorContainer, { transform: [{ translateX: shakeAnim }] }]}>
                <Ionicons name="alert-circle" size={16} color="#ff5252" />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        );
        
      case STEPS.VERIFY:
        return (
          <Animated.View 
            style={[
              styles.stepContainer, 
              { 
                opacity: fadeAnim, 
                transform: [
                  { translateY: slideAnim },
                  { translateX: shakeAnim }
                ] 
              }
            ]}
          > 
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark-outline" size={40} color="#ff9f43" />
            </View>
            <Text style={styles.stepTitle}>Vérification</Text>
            <Text style={styles.stepSubtitle}>
              Entrez le code envoyé à votre téléphone
            </Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="keypad" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.modernInput, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor="#666"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.disabledButton]} 
              onPress={handleLogin} 
              activeOpacity={0.8}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ['#666', '#555'] : ['#ff9f43', '#ff7675']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Vérifier</Text>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            {error ? (
              <Animated.View style={[styles.errorContainer, { transform: [{ translateX: shakeAnim }] }]}>
                <Ionicons name="alert-circle" size={16} color="#ff5252" />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        );
        
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Animated Background */}
      <Animated.View
        style={[
          styles.backgroundGradient,
          {
            transform: [
              {
                translateX: backgroundShift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 50],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#fff', '#f7f7f7']}
          locations={[0, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      
      {/* Floating Particles */}
      {renderFloatingParticles()}
      
      {/* Progress Bar */}
      {renderProgressBar()}
      
      <FirebaseRecaptchaVerifierModal 
        ref={recaptchaVerifier} 
        firebaseConfig={firebaseConfig} 
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined} 
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {renderStep()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    overflow: 'visible',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: -100,
    right: -100,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#ff9f43',
    borderRadius: 2,
    shadowColor: '#ff9f43',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 3,
  },
  progressContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff9f43',
    borderRadius: 2,
  },
  progressText: {
    color: '#ff9f43',
    fontSize: 12,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 100,
    paddingBottom: 50,
    overflow: 'visible',
  },
  stepContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  bigLogo: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 1,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 159, 67, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 159, 67, 0.3)',
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginBottom: 10,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 20,
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    top: 18,
    zIndex: 1,
  },
  modernInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 50,
    paddingVertical: 18,
    fontSize: 16,
    color: '#222',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  passwordToggle: {
    position: 'absolute',
    right: 15,
    top: 18,
    zIndex: 1,
  },
  phoneInputContainer: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingLeft: 40,
  },
  phoneTextContainer: {
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  phoneInputText: {
    color: '#000',
    fontSize: 16,
  },
  phoneCodeText: {
    color: '#222',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 30,
    width: '100%',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#ff9f43',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  primaryButton: {
    width: '100%',
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#ff9f43',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 30,
    gap: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.3)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#ff5252',
    fontWeight: '500',
  },
});