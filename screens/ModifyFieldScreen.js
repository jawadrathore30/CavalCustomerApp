import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
  StatusBar,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { auth, firestore } from "../firebase.config";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";

const ModifyFieldScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { field, title } = route.params;
  const [value, setValue] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  useEffect(() => {
    // If the field is not "password," fetch the current value from Firestore.
    if (field !== "password") {
      const fetchData = async () => {
        const user = auth.currentUser;
        if (user) {
          try {
            const docRef = doc(firestore, "Customers", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (field === "email") {
                setValue(data.email || user.email);
              } else if (field === "name") {
                const fullName = data.firstName
                  ? data.firstName + (data.lastName ? " " + data.lastName : "")
                  : "";
                setValue(fullName);
              } else if (field === "phone") {
                setValue(data.number || "");
              }
            }
          } catch (error) {
            console.error("Erreur lors de la récupération des données : ", error);
          }
        }
      };
      fetchData();
    }
  }, [field]);

  useEffect(() => {
    if (field === "password") {
      // Basic password strength check
      if (newPassword.length === 0) {
        setPasswordStrength(0);
      } else if (newPassword.length < 6) {
        setPasswordStrength(1); // Weak
      } else if (newPassword.length < 10) {
        setPasswordStrength(2); // Medium
      } else {
        setPasswordStrength(3); // Strong
      }
      
      // Check if passwords match
      setPasswordsMatch(newPassword === confirmPassword || confirmPassword === "");
    }
  }, [newPassword, confirmPassword]);

  const renderPasswordStrength = () => {
    if (newPassword.length === 0) return null;
    
    const labels = ["Faible", "Moyen", "Fort"];
    const colors = ["#FF4D4D", "#FFD700", "#4CAF50"];
    
    return (
      <View style={styles.strengthContainer}>
        <Text style={styles.strengthLabel}>Force: {labels[passwordStrength - 1]}</Text>
        <View style={styles.strengthBars}>
          <View style={[styles.strengthBar, { backgroundColor: passwordStrength >= 1 ? colors[0] : "#444" }]} />
          <View style={[styles.strengthBar, { backgroundColor: passwordStrength >= 2 ? colors[1] : "#444" }]} />
          <View style={[styles.strengthBar, { backgroundColor: passwordStrength >= 3 ? colors[2] : "#444" }]} />
        </View>
      </View>
    );
  };

  const handleSave = async () => {
    setLoading(true);
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Erreur", "Utilisateur non connecté");
      setLoading(false);
      return;
    }

    try {
      // Password update
      if (field === "password") {
        if (!oldPassword || !newPassword || !confirmPassword) {
          Alert.alert("Erreur", "Veuillez remplir tous les champs.");
          setLoading(false);
          return;
        }
        
        if (newPassword !== confirmPassword) {
          Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
          setLoading(false);
          return;
        }
        
        if (passwordStrength < 2) {
          Alert.alert("Attention", "Votre mot de passe est trop faible. Nous recommandons un mot de passe d'au moins 8 caractères incluant des chiffres et des caractères spéciaux.");
          setLoading(false);
          return;
        }
        
        // Re-authenticate with the old password
        const credential = EmailAuthProvider.credential(user.email, oldPassword);
        await reauthenticateWithCredential(user, credential);
        // Update the password
        await updatePassword(user, newPassword);
        Alert.alert("Succès", "Mot de passe mis à jour avec succès.");
      }
      // Email update
      else if (field === "email") {
        if (!value) {
          Alert.alert("Erreur", "La valeur ne peut pas être vide.");
          setLoading(false);
          return;
        }
        if (value !== user.email) {
          await updateEmail(user, value);
        }
        const docRef = doc(firestore, "Customers", user.uid);
        await updateDoc(docRef, { email: value });
        Alert.alert("Succès", `${title} mis à jour avec succès.`);
      }
      // Name update
      else if (field === "name") {
        if (!value) {
          Alert.alert("Erreur", "La valeur ne peut pas être vide.");
          setLoading(false);
          return;
        }
        const nameParts = value.trim().split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || "";
        const docRef = doc(firestore, "Customers", user.uid);
        await updateDoc(docRef, { firstName, lastName });
        Alert.alert("Succès", `${title} mis à jour avec succès.`);
      }
      // Phone update
      else if (field === "phone") {
        if (!value) {
          Alert.alert("Erreur", "La valeur ne peut pas être vide.");
          setLoading(false);
          return;
        }
        const docRef = doc(firestore, "Customers", user.uid);
        await updateDoc(docRef, { number: value });
        Alert.alert("Succès", `${title} mis à jour avec succès.`);
      }

      navigation.goBack();
    } catch (error) {
      console.error("Erreur lors de la mise à jour du champ : ", error);
      Alert.alert("Erreur", error.message);
    } finally {
      setLoading(false);
    }
  };

  const getIconName = () => {
    switch(field) {
      case "email": return "mail-outline";
      case "name": return "person-outline";
      case "phone": return "call-outline";
      case "password": return "lock-closed-outline";
      default: return "create-outline";
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#101010" />
      
      {/* Header with a back button and a centered title */}
      <LinearGradient
        colors={['#1E1E1E', '#121212']}
        style={styles.headerContainer}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#FF6F00" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity style={styles.helpButton}>
          <Ionicons name="help-circle-outline" size={24} color="#FF6F00" />
        </TouchableOpacity>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Icon section */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name={getIconName()} size={40} color="#FF6F00" />
            </View>
            <Text style={styles.iconTitle}>Procéder à {title.toLowerCase()}</Text>
            <Text style={styles.iconSubtitle}>
              {field === "password" 
                ? "Assurez-vous que votre mot de passe soit fort et sécurisé"
                : `Mettez à jour votre ${title.toLowerCase()} en toute simplicité`}
            </Text>
          </View>
          
          <View style={styles.inputCard}>
            {field === "password" ? (
              <>
                <View style={styles.inputContainer}>
                  <View style={styles.inputLabelRow}>
                    <Ionicons name="key-outline" size={18} color="#FF6F00" />
                    <Text style={styles.label}>Ancien mot de passe</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="Entrez votre ancien mot de passe"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputLabelRow}>
                    <Ionicons name="lock-closed-outline" size={18} color="#FF6F00" />
                    <Text style={styles.label}>Nouveau mot de passe</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="Entrez un nouveau mot de passe"
                    placeholderTextColor="#666"
                  />
                  {renderPasswordStrength()}
                </View>
                
                <View style={styles.inputContainer}>
                  <View style={styles.inputLabelRow}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#FF6F00" />
                    <Text style={styles.label}>Confirmer le mot de passe</Text>
                  </View>
                  <TextInput
                    style={[styles.input, !passwordsMatch && {borderColor: "#FF4D4D"}]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="Confirmez votre nouveau mot de passe"
                    placeholderTextColor="#666"
                  />
                  {!passwordsMatch && (
                    <Text style={styles.errorText}>Les mots de passe ne correspondent pas</Text>
                  )}
                </View>
                
                <View style={styles.passwordTips}>
                  <Text style={styles.tipsTitle}>Conseils de sécurité :</Text>
                  <View style={styles.tipRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.tipText}>Utilisez au moins 8 caractères</Text>
                  </View>
                  <View style={styles.tipRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.tipText}>Incluez des chiffres et des caractères spéciaux</Text>
                  </View>
                  <View style={styles.tipRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.tipText}>Évitez les informations personnelles identifiables</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.inputContainer}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name={getIconName()} size={18} color="#FF6F00" />
                  <Text style={styles.label}>{title}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={setValue}
                  autoCapitalize={field === "name" ? "words" : "none"}
                  placeholder={` ${title.toLowerCase()}`}
                  placeholderTextColor="#666"
                  keyboardType={
                    field === "email"
                      ? "email-address"
                      : field === "phone"
                      ? "phone-pad"
                      : "default"
                  }
                />
                {field === "email" && (
                  <Text style={styles.helperText}>
                    Assurez-vous d'utiliser une adresse email valide à laquelle vous avez accès
                  </Text>
                )}
                {field === "phone" && (
                  <Text style={styles.helperText}>
                    Incluez l'indicatif de pays (ex: +33 pour la France)
                  </Text>
                )}
              </View>
            )}

            {/* Show ActivityIndicator or Save button */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6F00" />
                <Text style={styles.loadingText}>Mise à jour en cours...</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.button}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF8F00', '#FF6F00']}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="save-outline" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Enregistrer les modifications</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>
              Pour toute assistance, contactez notre service client, visiter Caval.tech
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ModifyFieldScreen;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#121212", // Dark background
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    paddingBottom: 15,
    paddingHorizontal: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    padding: 5,
  },
  helpButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 111, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 111, 0, 0.3)',
  },
  iconTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
    textAlign: 'center',
  },
  iconSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    maxWidth: '80%',
  },
  inputCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    paddingHorizontal: 15,
    color: "#fff",
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  helperText: {
    color: '#999',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  errorText: {
    color: '#FF4D4D',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  strengthContainer: {
    marginTop: 8,
  },
  strengthLabel: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 3,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  passwordTips: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  tipText: {
    color: '#ccc',
    fontSize: 12,
    marginLeft: 5,
  },
  button: {
    borderRadius: 12,
    marginTop: 10,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: "#FF6F00",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  buttonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  loadingText: {
    color: '#ccc',
    marginTop: 10,
    fontSize: 14,
  },
  footerContainer: {
    marginTop: 30,
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerText: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
  },
});