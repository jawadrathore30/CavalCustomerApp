import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { doc, getDoc } from "firebase/firestore";
import { auth, firestore } from "../firebase.config";
import { LinearGradient } from "expo-linear-gradient";

const AccountScreen = () => {
  const navigation = useNavigation();

  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) {
          Alert.alert("Erreur", "Utilisateur non connecté");
          navigation.navigate("LoginScreen");
          return;
        }
        const docRef = doc(firestore, "Customers", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserDetails(docSnap.data());
        } else {
          console.log("Aucun document trouvé pour cet utilisateur !");
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données utilisateur :", error);
        Alert.alert("Erreur", "Impossible de récupérer les informations utilisateur.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigation]);

  const handleOptionPress = (option) => {
    switch (option) {
      case "Modifier le nom":
        navigation.navigate("ModifyFieldScreen", {
          field: "name",
          title: "Modifier le nom",
        });
        break;
      case "Modifier l'email":
        navigation.navigate("ModifyFieldScreen", {
          field: "email",
          title: "Modifier l'email",
        });
        break;
      case "Ajouter/Modifier le numéro de téléphone":
        navigation.navigate("ModifyFieldScreen", {
          field: "phone",
          title: "Ajouter/Modifier le numéro de téléphone",
        });
        break;
      case "Modifier le mot de passe":
        navigation.navigate("ModifyFieldScreen", {
          field: "password",
          title: "Modifier le mot de passe",
        });
        break;
      case "Méthodes de paiement":
        navigation.navigate("PaymentMethodsScreen");
        break;
      default:
        Alert.alert(option, `Option sélectionnée : ${option}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FF6F00" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mainContainer}>
      <LinearGradient
        colors={["#1E1E1E", "#121212"]}
        style={styles.headerContainer}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color="#FF6F00" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Paramètres du compte</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {userDetails ? (
          <LinearGradient
            colors={["#2A2A2A", "#1E1E1E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileCard}
          >
            {userDetails.photo ? (
              <Image source={{ uri: userDetails.photo }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.placeholderPhoto}>
                <Text style={styles.placeholderInitial}>
                  {userDetails?.firstName?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <Text style={styles.userName}>
              {userDetails.firstName} {userDetails.lastName}
            </Text>
            <View style={styles.infoContainer}>
              <View style={styles.infoItem}>
                <Ionicons name="mail-outline" size={20} color="#FF6F00" style={styles.infoIcon} />
                <Text style={styles.infoText}>{userDetails.email}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="call-outline" size={20} color="#FF6F00" style={styles.infoIcon} />
                <Text style={styles.infoText}>
                  {userDetails.number ? userDetails.number : "Téléphone non renseigné"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.profileCard}>
            <Text style={styles.noUserText}>Informations utilisateur introuvables.</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Paramètres du profil</Text>

        <TouchableOpacity 
          style={styles.optionItem} 
          onPress={() => handleOptionPress("Modifier le nom")}
        >
          <View style={styles.optionIconContainer}>
            <Ionicons name="person-outline" size={22} color="#FF6F00" />
          </View>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionText}>Modifier le nom</Text>
            <Text style={styles.optionSubtext}>Mettez à jour vos informations personnelles</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.optionItem} 
          onPress={() => handleOptionPress("Modifier l'email")}
        >
          <View style={styles.optionIconContainer}>
            <Ionicons name="mail-outline" size={22} color="#FF6F00" />
          </View>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionText}>Modifier l'email</Text>
            <Text style={styles.optionSubtext}>Mettre à jour votre adresse email</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.optionItem} 
          onPress={() => handleOptionPress("Ajouter/Modifier le numéro de téléphone")}
        >
          <View style={styles.optionIconContainer}>
            <Ionicons name="call-outline" size={22} color="#FF6F00" />
          </View>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionText}>Numéro de téléphone</Text>
            <Text style={styles.optionSubtext}>Ajouter ou modifier votre numéro</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.optionItem} 
          onPress={() => handleOptionPress("Méthodes de paiement")}
        >
          <View style={styles.optionIconContainer}>
            <Ionicons name="wallet-outline" size={22} color="#FF6F00" />
          </View>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionText}>Méthodes de paiement</Text>
            <Text style={styles.optionSubtext}>Gérer vos cartes bancaires et options de paiement</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#666" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Sécurité</Text>

        <TouchableOpacity 
          style={styles.optionItem} 
          onPress={() => handleOptionPress("Modifier le mot de passe")}
        >
          <View style={styles.optionIconContainer}>
            <Ionicons name="lock-closed-outline" size={22} color="#FF6F00" />
          </View>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionText}>Modifier le mot de passe</Text>
            <Text style={styles.optionSubtext}>Mettre à jour votre mot de passe</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#666" />
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>CAVAL Inc. © 2025</Text>
          <Text style={styles.footerSubtext}>Tous droits réservés</Text>
          <Text style={styles.footerSubtext}>Version 2.1.0</Text>
          <Text style={styles.footerSubtext}>Djibouti, République de Djibouti</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountScreen;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#121212",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 50,
    zIndex: 1,
  },
  headerText: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  loader: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profileCard: {
    borderRadius: 16,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 30,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  profilePhoto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderColor: "#FF6F00",
    borderWidth: 2,
    marginBottom: 15,
  },
  placeholderPhoto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#FF6F00",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  placeholderInitial: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#fff",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 10,
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  infoContainer: {
    marginTop: 10,
    width: "100%",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoIcon: {
    marginRight: 12,
  },
  infoText: {
    fontSize: 16,
    color: "#ddd",
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  noUserText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FF6F00",
    marginBottom: 15,
    marginTop: 5,
    paddingLeft: 10,
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    paddingVertical: 16,
    paddingHorizontal: 15,
    borderRadius: 14,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 111, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "500",
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  optionSubtext: {
    fontSize: 13,
    color: "#999",
    marginTop: 3,
    fontFamily: Platform.select({
      ios: "Helvetica Neue",
      android: "Roboto",
      default: "System",
    }),
  },
  footer: {
    marginTop: 40,
    marginBottom: 20,
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    fontSize: 16,
    color: '#FF6F00',
    fontWeight: '600',
    marginBottom: 8,
  },
  footerSubtext: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
});