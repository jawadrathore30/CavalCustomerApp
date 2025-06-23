import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  Easing,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  BackHandler
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "../firebase.config";
import { getAuth } from "firebase/auth";
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from "expo-location";

const { width, height } = Dimensions.get("window");

// Use the same API key as other screens
const GOOGLE_API_KEY = 'AIzaSyBnVN-ACYzcA0Sy8BcPLpXG50Y9T8jhJGE';

const FindingDriverScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [loadingDots, setLoadingDots] = useState(".");
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [driverPhone, setDriverPhone] = useState(null);
  const [driverData, setDriverData] = useState(null);
  const [rideStatus, setRideStatus] = useState(null);
  const [cancelProgress, setCancelProgress] = useState(0);
  const cancelAnim = useRef(new Animated.Value(0)).current;
  const cancelTimer = useRef(null);

  // Paramètres passés depuis l'écran précédent
  const { rideRequestId, origin, destination, rideType, distance, duration } = route.params || {};

  // État pour les adresses
  const [originAddress, setOriginAddress] = useState(origin?.address || "Chargement de l'adresse...");
  const [destinationAddress, setDestinationAddress] = useState(destination?.address || "Chargement de l'adresse...");
  
  // Default location (Djibouti City coordinates)
  const DEFAULT_LOCATION = {
    latitude: 11.5890,
    longitude: 43.1450,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // Région initiale
  const [mapRegion, setMapRegion] = useState({
    latitude: origin?.latitude || 37.7749,
    longitude: origin?.longitude || -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const mapRef = useRef(null);
  const navigationDoneRef = useRef(false);

  // État pour stocker les coordonnées de l'itinéraire
  const [routeCoords, setRouteCoords] = useState([]);

  // Prevent going back
  useEffect(() => {
    // Prevent back button on Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return true; // Prevent default behavior
    });

    // Prevent navigation gestures
    navigation.setOptions({
      gestureEnabled: false,
      gestureDirection: 'horizontal',
    });

    return () => {
      backHandler.remove();
    };
  }, [navigation]);

  // Animation de pulsation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  // Animation pour les points de chargement (...)
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingDots(dots => dots.length >= 3 ? "." : dots + ".");
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Obtenir la position actuelle si aucune origine n'est fournie
  useEffect(() => {
    const getCurrentLocation = async () => {
      if (!origin || !origin?.latitude || !origin?.longitude) {
        try {
          // First check if location services are enabled
          const enabled = await Location.hasServicesEnabledAsync();
          if (!enabled) {
            console.log("Location services are disabled, using default location");
            setMapRegion(DEFAULT_LOCATION);
            return;
          }

          // Then request permissions
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            console.log("Location permission denied, using default location");
            setMapRegion(DEFAULT_LOCATION);
            return;
          }

          // Try to get location with a timeout
          const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low, // Use lower accuracy for better success rate
            timeout: 5000 // 5 second timeout
          });

          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Location request timed out')), 5000);
          });

          // Race between location and timeout
          const location = await Promise.race([locationPromise, timeoutPromise]);

          if (location && location.coords) {
            setMapRegion({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            });
          } else {
            throw new Error('Invalid location data received');
          }
        } catch (error) {
          console.log("Location error, using default location:", error);
          setMapRegion(DEFAULT_LOCATION);
          
          // Show a non-blocking toast or message
          Alert.alert(
            "Information",
            "Impossible d'obtenir votre position exacte. Utilisation d'une position par défaut.",
            [{ text: "OK" }]
          );
        }
      }
    };

    getCurrentLocation();
  }, [origin]);

  // Récupérer les adresses d'origine et de destination si non fournies
  useEffect(() => {
    const fetchAddresses = async () => {
      if (origin && !origin?.address) {
        try {
          const address = await reverseGeocodeLocation(origin.latitude, origin.longitude);
          setOriginAddress(address);
        } catch (error) {
          console.log("Erreur lors de la récupération de l'adresse d'origine :", error);
        }
      }
      if (destination && !destination?.address) {
        try {
          const address = await reverseGeocodeLocation(destination.latitude, destination.longitude);
          setDestinationAddress(address);
        } catch (error) {
          console.log("Erreur lors de la récupération de l'adresse de destination :", error);
        }
      }
    };

    fetchAddresses();
  }, [origin, destination]);

  // Fonction de géocodage inversé
  const reverseGeocodeLocation = async (latitude, longitude) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === "OK" && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
      
      const result = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (result && result.length > 0) {
        const { street, name, city, region, country } = result[0];
        let addressComponents = [];
        if (street) addressComponents.push(street);
        else if (name) addressComponents.push(name);
        if (city) addressComponents.push(city);
        if (region) addressComponents.push(region);
        if (country) addressComponents.push(country);
        return addressComponents.join(", ");
      }
      return "Adresse introuvable";
    } catch (error) {
      console.log("Erreur lors du géocodage inversé :", error);
      return "Erreur lors de la récupération de l'adresse";
    }
  };

  // Force update map region when component mounts
  useEffect(() => {
    if (mapRef.current) {
      const newRegion = {
        latitude: origin?.latitude || 11.5890,
        longitude: origin?.longitude || 43.1450,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setMapRegion(newRegion);
      mapRef.current.animateToRegion(newRegion, 0);
    }
  }, []);

  // Appelée quand l'itinéraire est prêt
  const handleDirectionsReady = (result) => {
    if (result && result.coordinates && result.coordinates.length > 0) {
      setRouteCoords(result.coordinates);
      mapRef.current?.fitToCoordinates(result.coordinates, {
        edgePadding: { top: 5, right: 180, bottom: height * 0.5, left: 90 },
        animated: true
      });
    }
  };

  // Fonction pour recentrer la carte sur l'itinéraire
  const recenterMap = () => {
    if (routeCoords.length > 0) {
      mapRef.current?.fitToCoordinates(routeCoords, {
        edgePadding: { top: 5, right: 180, bottom: height * 0.5, left: 90 },
        animated: true
      });
    }
  };

  // Écoute les mises à jour de la demande de course
  useEffect(() => {
    if (!rideRequestId) return;

    const rideRequestRef = doc(firestore, "rideRequests", rideRequestId);
    const unsubscribe = onSnapshot(rideRequestRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Mise à jour de la demande de course :", data);
        
        // Update ride status
        setRideStatus(data.status);
        
        // Update driver data when available
        if (data.status === "assigned" && data.driverId) {
          console.log("Driver data received:", {
            phone: data.driverPhone,
            name: data.driverName,
            photo: data.driverPhoto,
            id: data.driverId
          });
          setDriverData(data);
          setDriverPhone(data.driverPhone);
          
          if (!navigationDoneRef.current) {
            navigationDoneRef.current = true;
            navigation.replace("DriverFoundScreen", {
              rideType,
              distance,
              duration,
              driverName: data.driverName || "Chauffeur",
              driverPhoto: data.driverPhoto,
              driverId: data.driverId,
              driverPhone: data.driverPhone,
              origin: {
                ...origin,
                address: origin?.address || (originAddress !== "Chargement de l'adresse..." ? originAddress : "Origine")
              },
              destination: {
                ...destination,
                address: destination?.address || (destinationAddress !== "Chargement de l'adresse..." ? destinationAddress : "Destination")
              },
            });
          }
        }
      }
    });
    return () => unsubscribe();
  }, [rideRequestId, navigation, rideType, distance, duration, origin, destination, originAddress, destinationAddress]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2]
  });

  // Annuler la demande de course
  const handleCancelRequest = async () => {
    try {
      console.log("Starting cancellation process...");
      
      // First, update Firestore
      if (rideRequestId) {
        console.log("Updating ride status in Firestore...");
        const rideRequestRef = doc(firestore, "rideRequests", rideRequestId);
        await updateDoc(rideRequestRef, {
          status: "declined",
          cancelledAt: new Date(),
          cancellationReason: "user_cancelled"
        });
        console.log("Ride request cancelled successfully in Firestore");
      } else {
        console.log("No rideRequestId found, skipping Firestore update");
      }
      
      console.log("Attempting to navigate to HomeTabs...");
      
      // Use a direct navigation approach
      navigation.navigate("HomeTabs");
      
    } catch (error) {
      console.error("Error cancelling ride request:", error);
      Alert.alert(
        "Erreur",
        "Une erreur est survenue lors de l'annulation de la demande. Veuillez réessayer."
      );
    }
  };

  // Start cancel animation
  const startCancelAnimation = () => {
    // Reset progress
    setCancelProgress(0);
    cancelAnim.setValue(0);
    
    // Clear any existing timer
    if (cancelTimer.current) {
      clearInterval(cancelTimer.current);
    }
    
    // Start animation
    Animated.timing(cancelAnim, {
      toValue: 1,
      duration: 1000, // 1 second
      useNativeDriver: false,
    }).start();
    
    // Update progress every 100ms
    let progress = 0;
    cancelTimer.current = setInterval(() => {
      progress += 0.1;
      setCancelProgress(progress);
      
      // When progress reaches 1, cancel the ride
      if (progress >= 1) {
        clearInterval(cancelTimer.current);
        handleCancelRequest();
      }
    }, 100);
  };
  
  // Cancel the animation if user releases before 1 second
  const cancelAnimation = () => {
    if (cancelTimer.current) {
      clearInterval(cancelTimer.current);
      cancelAnim.setValue(0);
      setCancelProgress(0);
    }
  };

  // Call driver function
  const callDriver = () => {
    console.log("Current driver phone:", driverPhone);
    console.log("Current driver data:", driverData);
    console.log("Current ride status:", rideStatus);
    
    if (rideStatus !== "active") {
      Alert.alert(
        "Information",
        "Vous pourrez appeler le chauffeur une fois que le trajet aura commencé."
      );
      return;
    }
    
    if (driverData?.driverPhone) {
      // Remove any non-numeric characters from the phone number
      const cleanPhoneNumber = driverData.driverPhone.replace(/\D/g, '');
      // Add the international prefix if not present
      const formattedNumber = cleanPhoneNumber.startsWith('+') ? cleanPhoneNumber : `+${cleanPhoneNumber}`;
      console.log("Attempting to call:", formattedNumber);
      
      Linking.openURL(`tel:${formattedNumber}`).catch(err => {
        console.log("Error opening phone app:", err);
        Alert.alert(
          "Erreur",
          "Impossible d'ouvrir l'application téléphone. Veuillez vérifier votre connexion ou réessayer plus tard."
        );
      });
    } else {
      Alert.alert(
        "Information",
        "Le numéro de téléphone du chauffeur n'est pas disponible pour le moment."
      );
    }
  };

  // Message driver function
  const textDriver = () => {
    console.log("Current driver phone:", driverPhone);
    console.log("Current driver data:", driverData);
    console.log("Current ride status:", rideStatus);
    
    if (rideStatus !== "active") {
      Alert.alert(
        "Information",
        "Vous pourrez envoyer un message au chauffeur une fois que le trajet aura commencé."
      );
      return;
    }
    
    if (driverData?.driverPhone) {
      // Remove any non-numeric characters from the phone number
      const cleanPhoneNumber = driverData.driverPhone.replace(/\D/g, '');
      // Add the international prefix if not present
      const formattedNumber = cleanPhoneNumber.startsWith('+') ? cleanPhoneNumber : `+${cleanPhoneNumber}`;
      console.log("Attempting to message:", formattedNumber);
      
      Linking.openURL(`sms:${formattedNumber}`).catch(err => {
        console.log("Error opening messaging app:", err);
        Alert.alert(
          "Erreur",
          "Impossible d'ouvrir l'application de messagerie. Veuillez vérifier votre connexion ou réessayer plus tard."
        );
      });
    } else {
      Alert.alert(
        "Information",
        "Le numéro de téléphone du chauffeur n'est pas disponible pour le moment."
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView 
          ref={mapRef}
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={(region) => setMapRegion(region)}
          showsUserLocation={true}
          showsMyLocationButton={true}
          initialRegion={DEFAULT_LOCATION}
        >
          {/* Marqueur de départ */}
          {origin && (
            <Marker 
              coordinate={origin}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.markerContainer}>
                <Image
                  source={require("../assets/CustomPin.png")}
                  style={styles.pin}
                  resizeMode="contain"
                />
                <Text style={styles.markerLabel} numberOfLines={1} ellipsizeMode="tail">
                  {origin?.address || (originAddress !== "Chargement de l'adresse..." ? originAddress : "Origine")}
                </Text>
              </View>
            </Marker>
          )}
          
          {/* Marqueur d'arrivée */}
          {destination && (
            <Marker 
              coordinate={destination}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.markerContainer}>
                <Image
                  source={require("../assets/CustomPin.png")}
                  style={styles.pin}
                  resizeMode="contain"
                />
                <Text style={styles.markerLabel} numberOfLines={1} ellipsizeMode="tail">
                  {destination?.address || (destinationAddress !== "Chargement de l'adresse..." ? destinationAddress : "Destination")}
                </Text>
              </View>
            </Marker>
          )}
          
          {/* Itinéraire entre le point de départ et d'arrivée */}
          {origin && destination && (
            <MapViewDirections
              origin={origin}
              destination={destination}
              apikey={GOOGLE_API_KEY}
              strokeWidth={4}
              strokeColor="#FF6F00"
              onReady={handleDirectionsReady}
            />
          )}
        </MapView>
        
        {/* Message de patience en haut de la carte */}
        <View style={styles.topMessageContainer}>
          <View style={styles.topMessageContent}>
            <Ionicons name="car-outline" size={20} color="#FF6F00" style={styles.topMessageIcon} />
            <Text style={styles.topMessageText}>
              <Text style={styles.topMessageHighlight}>Recherche en cours</Text> - Nous trouvons le chauffeur idéal pour votre trajet
            </Text>
          </View>
        </View>
        
        {/* Bouton pour recentrer la carte */}
        <TouchableOpacity style={styles.recenterButton} onPress={recenterMap}>
          <MaterialIcons name="my-location" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.overlay}>
        <View style={styles.searchingIndicator}>
          <Animated.View style={[styles.pulseCircle, {
            transform: [{ scale: pulseScale }]
          }]}>
            <View style={styles.innerCircle}>
              <MaterialIcons name="search" size={28} color="#FFF" />
            </View>
          </Animated.View>
        </View>

        <Text style={styles.overlayTitle}>
          Recherche d'un chauffeur{loadingDots}
        </Text>
        <Text style={styles.overlaySubtitle}>
          Nous recherchons le meilleur chauffeur pour vous
        </Text>

        <View style={styles.divider} />

        <View style={styles.routeInfo}>
          <View style={styles.locationItem}>
            <View style={styles.locationIconContainer}>
              <View style={[styles.locationIcon, styles.pickupIcon]}>
                <MaterialIcons name="my-location" size={16} color="#fff" />
              </View>
            </View>
            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
              {origin?.address || (originAddress !== "Chargement de l'adresse..." ? originAddress : "Origine")}
            </Text>
          </View>
          
          <View style={styles.locationDivider} />
          
          <View style={styles.locationItem}>
            <View style={styles.locationIconContainer}>
              <View style={[styles.locationIcon, styles.dropoffIcon]}>
                <MaterialIcons name="location-on" size={16} color="#fff" />
              </View>
            </View>
            <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
              {destination?.address || (destinationAddress !== "Chargement de l'adresse..." ? destinationAddress : "Destination")}
            </Text>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <MaterialIcons name="directions-car" size={22} color="#999" />
            <Text style={styles.infoText}>
              {rideType || "Véhicule standard"}
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <MaterialIcons name="route" size={22} color="#999" />
            <Text style={styles.infoText}>
              {distance ? `${distance.toFixed(1)} km` : "Distance non disponible"}
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <MaterialIcons name="access-time" size={22} color="#999" />
            <Text style={styles.infoText}>
              {duration ? `${Math.ceil(duration)} min` : "Durée non disponible"}
            </Text>
          </View>
        </View>

        {/* Only show action buttons if we have driver data */}
        {driverData?.driverPhone && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={callDriver}
            >
              <Ionicons name="call" size={22} color="#FF6F00" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={textDriver}
            >
              <Ionicons name="chatbubble-ellipses" size={22} color="#FF6F00" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cancelButtonContainer}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPressIn={startCancelAnimation}
            onPressOut={cancelAnimation}
          >
            <Animated.View 
              style={[
                styles.cancelProgressBar, 
                { 
                  width: cancelAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  })
                }
              ]} 
            />
            <Text style={styles.cancelButtonText}>
              {cancelProgress >= 1 ? "Annulation..." : "Annuler la demande"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default FindingDriverScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 30,
    zIndex: 100,
  },
  recenterButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 30,
    zIndex: 100,
  },
  pin: {
    width: 30,
    height: 30,
  },
  markerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,30,30,0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  markerLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 5,
    maxWidth: 120,
    textAlign: "left",
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    alignItems: 'center',
    paddingTop: 25,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
    backgroundColor: '#1E1E1E',
  },
  searchingIndicator: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,111,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6F00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6F00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  overlayTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  overlaySubtitle: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 16,
  },
  divider: {
    width: '90%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  routeInfo: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  locationIconContainer: {
    width: 30,
    alignItems: 'center',
    marginRight: 10,
  },
  locationIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupIcon: {
    backgroundColor: '#4CAF50',
  },
  dropoffIcon: {
    backgroundColor: '#FF6F00',
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  locationDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginLeft: 15,
    marginVertical: 4,
  },
  infoContainer: {
    width: '100%',
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#DDD',
    fontWeight: '500',
  },
  cancelButtonContainer: {
    width: '100%',
    marginTop: 10,
    paddingHorizontal: 16,
    marginBottom: 30,
  },
  cancelButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#212121',
    overflow: 'hidden',
    position: 'relative',
  },
  cancelProgressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 111, 0, 0.3)',
    borderRadius: 25,
  },
  cancelButtonText: {
    color: '#FF6F00',
    fontSize: 16,
    fontWeight: '600',
    zIndex: 1,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  topMessageContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    padding: 12,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxWidth: width - 40,
    alignSelf: 'center',
  },
  topMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  topMessageIcon: {
    marginRight: 8,
  },
  topMessageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1,
  },
  topMessageHighlight: {
    color: '#FF6F00',
    fontWeight: '700',
  },
});
