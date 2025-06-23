import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from "react-native";
import {
  createUserWithEmailAndPassword,
  signInWithCredential,
  PhoneAuthProvider,
} from "firebase/auth";
import { auth, firestore } from "../firebase.config";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import CavalLogo from "../assets/Caval_Logo-removebg-preview.png";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import CustomPhoneInput from "./CustomPhoneInput";

function RegisterScreen() {
  // Basic user fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [registrationMethod, setRegistrationMethod] = useState("email"); // "email" or "phone"
  const [error, setError] = useState('');
  
  // Phone input reference
  const phoneInput = useRef(null);

  const navigation = useNavigation();

  const sendVerificationCode = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!number || number.length < 8) {
        setError('Please enter a valid phone number');
        return;
      }

      // Format phone number to E.164 format
      const formattedPhone = number.startsWith('+') ? number : `+${number}`;
      
      // Use Firebase's built-in phone auth
      const phoneProvider = new PhoneAuthProvider(auth);
      const verId = await phoneProvider.verifyPhoneNumber(
        formattedPhone,
        auth.currentUser
      );
      
      setVerificationId(verId);
      setShowVerification(true);
    } catch (err) {
      console.error('Error sending verification code:', err);
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    try {
      setLoading(true);
      setError('');

      if (!verificationCode || verificationCode.length !== 6) {
        setError('Please enter a valid verification code');
        return;
      }

      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      const userCredential = await signInWithCredential(auth, credential);
      
      const userRef = doc(firestore, 'Customers', userCredential.user.uid);
      await setDoc(userRef, {
        email: userCredential.user.email || "",
        firstName: fname,
        lastName: lname,
        number: number,
        createdAt: serverTimestamp(),
        authProvider: "phone",
      }, { merge: true });

      navigation.navigate("HomeTabs");
    } catch (err) {
      console.error('Error verifying code:', err);
      setError(err.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  // Standard email/password registration
  const handleRegister = async () => {
    try {
      if (!email || !password || !fname || !lname) {
        Alert.alert("Champs Manquants", "Veuillez remplir tous les champs requis");
        return;
      }

      setLoading(true);
      // Create the user with email/password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user data in Firestore
      await setDoc(doc(firestore, "Customers", user.uid), {
        email: user.email,
        firstName: fname,
        lastName: lname,
        number: number,
        createdAt: serverTimestamp(), // Using serverTimestamp() from Firestore
        authProvider: "email",
      });

      Alert.alert("Succès", "Compte créé avec succès !");
      navigation.navigate("LoginScreen");
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle opening privacy policy
  const openPrivacyPolicy = () => {
    Linking.openURL("https://www.caval.tech/privacy-policy");
  };

  // Handle back button press
  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <LinearGradient
      colors={["#121212", "#1a1a1a", "#212121"]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : null}
          style={styles.keyboardAvoidingView}
        >
          <Image source={CavalLogo} style={styles.image} resizeMode="contain" />

          <View style={styles.headerContainer}>
            <Text style={styles.title}>Créer un Compte</Text>
            <Text style={styles.subtitle}>
              Rejoignez Caval et commencez votre aventure avec nous
            </Text>
          </View>

          {/* Registration Method Toggle */}
          <View style={styles.methodToggleContainer}>
            <TouchableOpacity
              style={[
                styles.methodToggleButton,
                registrationMethod === "email" && styles.activeMethodToggle
              ]}
              onPress={() => setRegistrationMethod("email")}
            >
              <Text style={[
                styles.methodToggleText,
                registrationMethod === "email" && styles.activeMethodToggleText
              ]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodToggleButton,
                registrationMethod === "phone" && styles.activeMethodToggle
              ]}
              onPress={() => setRegistrationMethod("phone")}
            >
              <Text style={[
                styles.methodToggleText,
                registrationMethod === "phone" && styles.activeMethodToggleText
              ]}>Téléphone</Text>
            </TouchableOpacity>
          </View>

          {/* Name Fields Row - Always visible */}
          <View style={styles.nameContainer}>
            {/* First Name */}
            <View style={[styles.inputContainer, styles.halfInput]}>
              <Text style={styles.inputLabel}>Prénom</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#aaa" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Jean"
                  onChangeText={setFname}
                  value={fname}
                  placeholderTextColor="#777"
                />
              </View>
            </View>

            {/* Last Name */}
            <View style={[styles.inputContainer, styles.halfInput]}>
              <Text style={styles.inputLabel}>Nom</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#aaa" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Dupont"
                  onChangeText={setLname}
                  value={lname}
                  placeholderTextColor="#777"
                />
              </View>
            </View>
          </View>

          {registrationMethod === "email" ? (
            // Email Registration Form
            <>
              {/* Email */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Adresse Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#aaa" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="email@exemple.com"
                    onChangeText={setEmail}
                    value={email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#777"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Mot de Passe</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#aaa" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="********"
                    onChangeText={setPassword}
                    value={password}
                    secureTextEntry
                    placeholderTextColor="#777"
                  />
                </View>
                <Text style={styles.passwordHint}>Doit contenir au moins 8 caractères</Text>
              </View>

              {/* Sign Up with Email Button */}
              <TouchableOpacity
                style={styles.button}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Créer un Compte</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            // Phone Registration Form
            <>
              {/* Phone Number */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Numéro de Téléphone</Text>
                <CustomPhoneInput
                  value={number}
                  onChangeFormattedText={(text) => {
                    setNumber(text);
                  }}
                  containerStyle={styles.phoneInputContainer}
                  textContainerStyle={styles.phoneTextContainer}
                  textInputStyle={styles.phoneInputText}
                  codeTextStyle={styles.phoneCodeText}
                  defaultCode="DJ"
                />
              </View>

              {/* Error message display */}
              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              {/* Verification code input - only shown after sending code */}
              {showVerification && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Code de Vérification</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="key-outline" size={20} color="#aaa" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="123456"
                      onChangeText={setVerificationCode}
                      value={verificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholderTextColor="#777"
                    />
                  </View>
                </View>
              )}

              {/* Phone Verification Buttons */}
              {!showVerification ? (
                <TouchableOpacity
                  style={styles.phoneButton}
                  onPress={sendVerificationCode}
                  disabled={loading || !number}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.phoneButtonText}>Vérifier le Numéro</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.phoneButton}
                  onPress={verifyCode}
                  disabled={loading || !verificationCode}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.phoneButtonText}>Confirmer le Code</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Terms of service with navigation to privacy policy */}
          <Text style={styles.termsText}>
            En créant un compte, vous acceptez nos{" "}
            <Text style={styles.link} onPress={openPrivacyPolicy}>
              Conditions d'Utilisation
            </Text>{" "}
            et notre{" "}
            <Text style={styles.link} onPress={openPrivacyPolicy}>
              Politique de Confidentialité
            </Text>
          </Text>

          {/* Link to Login */}
          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>
              Vous avez déjà un compte ?{" "}
              <Text
                style={styles.link}
                onPress={() => navigation.navigate("LoginScreen")}
              >
                Connectez-vous
              </Text>
            </Text>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </LinearGradient>
  );
}

export default RegisterScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(40, 40, 40, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 150,
    height: 80,
    marginTop: 60,
    marginBottom: 20,
  },
  headerContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#bbb",
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
  },
  nameContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInput: {
    width: "48%",
  },
  inputContainer: {
    marginBottom: 18,
    width: "100%",
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#444",
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 55,
    fontSize: 16,
    color: "#fff",
  },
  passwordHint: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 4,
    marginLeft: 2,
  },
  phoneInputContainer: {
    width: "100%",
    height: 55,
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444",
  },
  phoneTextContainer: {
    borderRadius: 12,
    backgroundColor: "#2a2a2a",
  },
  phoneInputText: {
    fontSize: 16,
    color: "#fff",
  },
  phoneCodeText: {
    fontSize: 16,
    color: "#fff",
  },
  button: {
    backgroundColor: "#ff9f43",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#ff9f43",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  phoneButton: {
    backgroundColor: "#3498db",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#3498db",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  phoneButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  termsText: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 14,
    color: "#aaa",
    lineHeight: 20,
  },
  linkContainer: {
    marginTop: 25,
    alignItems: "center",
  },
  linkText: {
    color: "#bbb",
    fontSize: 16,
  },
  link: {
    color: "#ff9f43",
    fontWeight: "600",
  },
  methodToggleContainer: {
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444",
  },
  methodToggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeMethodToggle: {
    backgroundColor: "#ff9f43",
  },
  methodToggleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#aaa",
  },
  activeMethodToggleText: {
    color: "#fff",
    fontWeight: "700",
  },
  errorText: {
    color: "#ff6b6b",
    marginBottom: 10,
    fontSize: 14,
    textAlign: "center",
  },
});