// Profile.js
import React, { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Button,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

function Profile() {
  const [userDetails, setUserDetails] = useState(null);
  const navigation = useNavigation();

  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const docRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserDetails(docSnap.data());
          console.log(docSnap.data());
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    } else {
      console.log("User is not logged in");
      navigation.navigate("Login");
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  async function handleLogout() {
    try {
      await auth.signOut();
      console.log("User logged out successfully!");
      navigation.navigate("Login");
    } catch (error) {
      console.error("Error logging out:", error.message);
      Alert.alert("Error", error.message, [{ text: "OK" }]);
    }
  }

  if (!userDetails) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="100" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.profilePicContainer}>
        {userDetails.photo ? (
          <Image
            source={{ uri: userDetails.photo }}
            style={styles.profilePic}
          />
        ) : (
          <View style={styles.placeholderPic}>
            <Text style={styles.placeholderText}>
              {userDetails.firstName.charAt(0)}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.welcomeText}>
        Welcome {userDetails.firstName} 🙏🙏
      </Text>
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>Email: {userDetails.email}</Text>
        <Text style={styles.infoText}>
          First Name: {userDetails.firstName}
        </Text>
        {/* Uncomment if lastName is used */}
        {/* <Text style={styles.infoText}>Last Name: {userDetails.lastName}</Text> */}
      </View>
      <Button title="Logout" onPress={handleLogout} color="#0066cc" />
    </View>
  );
}

export default Profile;

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  profilePicContainer: {
    marginTop: 30,
    marginBottom: 20,
  },
  profilePic: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  placeholderPic: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 50,
    color: "#fff",
  },
  welcomeText: {
    fontSize: 24,
    marginBottom: 20,
  },
  infoContainer: {
    alignSelf: "stretch",
    marginBottom: 30,
  },
  infoText: {
    fontSize: 18,
    marginBottom: 10,
  },
});