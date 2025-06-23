import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StatusBar,
  Platform,
  Animated,
  ScrollView,
  Alert,
  Modal,
  SafeAreaView,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { useRoute, useNavigation, CommonActions } from "@react-navigation/native";
import { GOOGLE_MAPS_APIKEY } from "@env";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { firestore } from "../firebase.config";
import { Ionicons, MaterialIcons, Feather, FontAwesome5 } from "@expo/vector-icons";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import MessageButton from "../components/MessageButton";
import { getAuth } from "firebase/auth";
import { createDriverCustomerConversation } from '../utils/conversation';

const { height, width } = Dimensions.get("window");

// Define overlay heights
const COLLAPSED_HEIGHT = 250;
const EXPANDED_HEIGHT = height * 0.6;

// Modern dark map style with orange accents
const mapStyle = [
  { elementType: "geometry", stylers: [{ color: "#121212" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8f8f8f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#333333" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#8f8f8f" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#333333" }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#333333" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#111111" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#8f8f8f" }] },
  { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#8f8f8f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b2b2b" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8f8f8f" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2b2b2b" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#2b2b2b" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#8f8f8f" }] },
  { featureType: "transit", elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "transit.line", elementType: "geometry.fill", stylers: [{ color: "#2b2b2b" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#2b2b2b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#8f8f8f" }] },
];

// Modern orange and black color theme
const THEME = {
  primary: "#FF6B00",       // Main orange
  secondary: "#FF8C38",     // Lighter orange
  accent: "#FFAA70",        // Very light orange
  background: "#121212",    // Dark background
  card: "#1E1E1E",          // Card background
  cardLight: "#2D2D2D",     // Lighter card for hierarchy
  text: "#FFFFFF",          // White text
  textSecondary: "#E0E0E0", // Light gray for secondary text
  textMuted: "#9E9E9E",     // Muted text color
  border: "rgba(255,255,255,0.12)",
  success: "#66BB6A",
  warning: "#FFAB40",
  error: "#F44336",
  shadow: "rgba(0,0,0,0.7)",
  overlay: "rgba(18,18,18,0.9)",
};

const DriverFoundScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const overlayHeightAnim = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const headerOpacityAnim = useRef(new Animated.Value(0)).current;

  // Set a random ETA between 5 and 12 minutes
  const [randomETA, setRandomETA] = useState(5);
  useEffect(() => {
    const eta = Math.floor(Math.random() * (12 - 5 + 1)) + 5;
    setRandomETA(eta);
  }, []);

  const {
    rideType,
    distance,
    duration,
    driverName,
    driverPhoto,
    driverId,
    driverPhone,
    driverRating = 4.9,
    origin: routeOrigin,
    destination,
    dropOffLocation: passedDropOffLocation,
    destinationLat,
    destinationLng,
    destinationAddress,
    pickupLat,
    pickupLng,
    rideId,
    fare,
  } = route.params || {};

  const [mapRegion, setMapRegion] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [originAddress, setOriginAddress] = useState("");
  const [destinationData, setDestinationData] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverDistanceToCustomer, setDriverDistanceToCustomer] = useState(null);
  const [driverEtaToCustomer, setDriverEtaToCustomer] = useState(null);
  const [tripPhase, setTripPhase] = useState("pickup");
  const [expandedOverlay, setExpandedOverlay] = useState(false);
  const [rideStatus, setRideStatus] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const mapRef = useRef(null);
  const pulseAnimationRef = useRef(null);
  const scrollRef = useRef(null);

  // Listen for ride status changes
  useEffect(() => {
    if (!rideId) return;

    const rideRequestRef = doc(firestore, "rideRequests", rideId);
    const unsubscribe = onSnapshot(rideRequestRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRideStatus(data.status);
        
        // If ride is completed, navigate to HomeTabs
        if (data.status === "completed") {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                { 
                  name: 'HomeTabs',
                  state: {
                    routes: [
                      { name: 'Home' }
                    ]
                  }
                }
              ],
            })
          );
        }
      }
    });

    return () => unsubscribe();
  }, [rideId, navigation]);

  // Start entry and pulse animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    pulseAnimationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimationRef.current.start();

    return () => {
      if (pulseAnimationRef.current) pulseAnimationRef.current.stop();
    };
  }, []);

  // Set origin using route or pickup coordinates
  useEffect(() => {
    if (routeOrigin) {
      setOrigin(routeOrigin);
      setOriginAddress(routeOrigin.address || "");
    } else if (pickupLat && pickupLng) {
      const newOrigin = {
        latitude: parseFloat(pickupLat),
        longitude: parseFloat(pickupLng),
      };
      setOrigin(newOrigin);
      reverseGeocodeLocation(newOrigin.latitude, newOrigin.longitude).then((address) => {
        setOriginAddress(address);
        setOrigin((prev) => ({ ...prev, address }));
      });
    }
  }, [routeOrigin, pickupLat, pickupLng]);

  // Set destination using available parameters
  useEffect(() => {
    console.log("Destination debug:", {
      destination,
      passedDropOffLocation,
      destinationLat,
      destinationLng,
      destinationAddress
    });
    
    if (destination) {
      setDestinationData(destination);
    } else if (passedDropOffLocation) {
      setDestinationData(passedDropOffLocation);
    } else if (destinationLat && destinationLng) {
      const newDestination = {
        latitude: parseFloat(destinationLat),
        longitude: parseFloat(destinationLng),
        address: destinationAddress || "",
      };
      setDestinationData(newDestination);
      if (!destinationAddress) {
        reverseGeocodeLocation(newDestination.latitude, newDestination.longitude).then((address) => {
          setDestinationData((prev) => ({ ...prev, address }));
        });
      }
    }
  }, [destination, passedDropOffLocation, destinationLat, destinationLng, destinationAddress]);

  // Initialize map region using origin coordinates
  useEffect(() => {
    if (origin?.latitude && origin?.longitude) {
      setMapRegion({
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }
  }, [origin]);

  // Get current user location for display purposes only
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Location permission not granted");
          return;
        }
        const currentPosition = await Location.getCurrentPositionAsync({});
        if (currentPosition?.coords) {
          const { latitude, longitude } = currentPosition.coords;
          setUserLocation({ latitude, longitude });
        }
      } catch (error) {
        console.log("Location error:", error);
      }
    })();
  }, []);

  // Reverse geocoding function (using Google API first, fallback to Expo)
  const reverseGeocodeLocation = async (latitude, longitude) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_APIKEY}`;
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
      return "Adresse non trouvée";
    } catch (error) {
      console.log("Reverse geocode error:", error);
      return "Erreur d'adresse";
    }
  };

  // Listen for real-time driver location updates via Firebase
  useEffect(() => {
    if (!driverId) return;
    const driverDocRef = doc(firestore, "Drivers", driverId);
    const unsubscribe = onSnapshot(driverDocRef, (docSnapshot) => {
      const data = docSnapshot.data();
      if (data && data.latitude && data.longitude) {
        setDriverLocation({ latitude: data.latitude, longitude: data.longitude });
      }
    });
    return unsubscribe;
  }, [driverId]);

  const handleDriverRouteReady = (result) => {
    setDriverDistanceToCustomer(result.distance);
    setDriverEtaToCustomer(result.duration);
  };

  const handleCustomerRouteReady = (result) => {
    if (result && result.coordinates && result.coordinates.length > 0) {
      mapRef.current?.fitToCoordinates(result.coordinates, {
        edgePadding: { top: 140, right: 50, bottom: expandedOverlay ? 450 : 300, left: 50 },
        animated: true,
      });
    }
  };

  const handleCallDriver = () => {
    if (driverPhone) {
      Linking.openURL(`tel:${driverPhone}`);
    } else {
      Alert.alert("Information", "Numéro de téléphone du chauffeur non disponible");
    }
  };

  const textDriver = () => {
    if (driverPhone) {
      // Remove any non-numeric characters from the phone number
      const cleanPhoneNumber = driverPhone.replace(/\D/g, '');
      // Add the international prefix if not present
      const formattedNumber = cleanPhoneNumber.startsWith('+') ? cleanPhoneNumber : `+${cleanPhoneNumber}`;
      Linking.openURL(`sms:${formattedNumber}`).catch(err => {
        console.log("Error opening messaging app:", err);
        Alert.alert(
          "Erreur",
          "Impossible d'ouvrir l'application de messagerie."
        );
      });
    } else {
      Alert.alert(
        "Information",
        "Le numéro de téléphone du chauffeur n'est pas disponible."
      );
    }
  };

  const openCavalContact = () => {
    Linking.openURL("https://www.caval.tech/contact");
  };

  const shareRide = () => {
    const message = `Je suis en route vers ${destinationData?.address || "ma destination"} avec Caval. Mon chauffeur ${driverName || "est en route"} arrivera dans environ ${randomETA} minutes.`;
    if (Platform.OS === "ios") {
      Linking.openURL(`sms:&body=${encodeURIComponent(message)}`);
    } else {
      Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
    }
  };

  const toggleOverlayExpansion = () => {
    // Toggle overlay expansion and animate height plus header opacity
    setExpandedOverlay(!expandedOverlay);
    const newHeight = expandedOverlay ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT;
    const newHeaderOpacity = expandedOverlay ? 0 : 1;
    Animated.parallel([
      Animated.spring(overlayHeightAnim, {
        toValue: newHeight,
        tension: 20,
        friction: 7,
        useNativeDriver: false,
      }),
      Animated.timing(headerOpacityAnim, {
        toValue: newHeaderOpacity,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();

    // Adjust map markers padding after a short delay
    if (origin && destinationData) {
      setTimeout(() => {
        mapRef.current?.fitToSuppliedMarkers(["origin", "destination"], {
          edgePadding: {
            top: 150,
            right: 50,
            bottom: expandedOverlay ? 300 : 450,
            left: 50,
          },
          animated: true,
        });
      }, 300);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleCancelRide = async (reason) => {
    setIsCancelling(true);
    try {
      // Update ride status in Firestore
      const rideRequestRef = doc(firestore, "rideRequests", rideId);
      await updateDoc(rideRequestRef, {
        status: "declined",
        cancelledAt: new Date(),
        cancelledBy: "customer",
        cancellationReason: reason
      });
      
      // Navigate back to home screen
      navigation.navigate('HomeTabs', {
        screen: 'Home'
      });
    } catch (error) {
      console.error("Error cancelling ride:", error);
      Alert.alert(
        "Erreur",
        "Une erreur est survenue lors de l'annulation. Veuillez réessayer."
      );
    } finally {
      setIsCancelling(false);
      setShowCancelModal(false);
      setShowConfirmModal(false);
      setSelectedReason(null);
    }
  };

  if (!mapRegion) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <LinearGradient colors={[THEME.background, '#000']} style={styles.loadingGradient}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>CAVAL</Text>
          </View>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>Connexion avec votre chauffeur...</Text>
          <Text style={styles.loadingSubtext}>
            Veuillez patienter pendant que nous établissons la connexion
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        {/* Map Section */}
        <MapView
          ref={mapRef}
          style={styles.map}
          region={mapRegion}
          provider={PROVIDER_DEFAULT}
          customMapStyle={mapStyle}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsBuildings={true}
          showsTraffic={false}
          toolbarEnabled={false}
        >
          {driverLocation && origin && tripPhase === "pickup" && (
            <MapViewDirections
              origin={driverLocation}
              destination={origin}
              apikey={GOOGLE_MAPS_APIKEY}
              strokeWidth={4}
              strokeColor={THEME.secondary}
              lineDashPattern={[0]}
              onReady={handleDriverRouteReady}
            />
          )}
          {origin && destinationData && (
            <MapViewDirections
              origin={tripPhase === "pickup" ? origin : driverLocation}
              destination={destinationData}
              apikey={GOOGLE_MAPS_APIKEY}
              strokeWidth={4}
              strokeColor={THEME.primary}
              lineDashPattern={[0]}
              onReady={handleCustomerRouteReady}
            />
          )}
          
          {/* User location marker */}
          {userLocation && (
            <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.userLocationMarker}>
                <View style={styles.userLocationDot} />
                <Animated.View style={[styles.userLocationRing, { transform: [{ scale: pulseAnim }] }]} />
              </View>
            </Marker>
          )}
          
          {/* Origin marker */}
          {origin && (
            <Marker 
              identifier="origin"
              coordinate={origin} 
              anchor={{ x: 0.5, y: 0.5 }} 
              tracksViewChanges={false}
              zIndex={1000}
            >
              <View style={[styles.originMarkerContainer, { elevation: 5 }]}>
                <View style={[styles.originMarkerDot, { elevation: 5 }]} />
                <Text style={[styles.markerAddressPill, { elevation: 5 }]} numberOfLines={1}>
                  {originAddress || "Départ"}
                </Text>
              </View>
            </Marker>
          )}
          
          {/* Test marker to verify markers work */}
          <Marker 
            coordinate={{ latitude: 11.5890, longitude: 43.1450 }}
            pinColor="red"
            title="Test Marker"
            description="This is a test marker"
          />
          
          {/* Destination marker */}
          {(() => {
            console.log("=== DESTINATION DEBUG ===");
            console.log("destinationData:", destinationData);
            console.log("destination:", destination);
            console.log("destinationLat:", destinationLat);
            console.log("destinationLng:", destinationLng);
            console.log("destinationAddress:", destinationAddress);
            console.log("hasDestinationData:", !!(destinationData || destination));
            console.log("hasCoords:", !!(destinationLat && destinationLng));
            console.log("==========================");
            return null;
          })()}
          {(destinationData || destination) && (
            <Marker 
              identifier="destination"
              coordinate={destinationData || destination} 
              pinColor="#FF6B00"
              title="Destination"
              description={(destinationData?.address || destination?.address) || "Destination"}
              zIndex={1000}
            />
          )}
          
          {/* Fallback destination marker if no destination data */}
          {!destinationData && !destination && destinationLat && destinationLng && (
            <Marker 
              identifier="destination"
              coordinate={{ latitude: parseFloat(destinationLat), longitude: parseFloat(destinationLng) }} 
              pinColor="#FF6B00"
              title="Destination"
              description={destinationAddress || "Destination"}
              zIndex={1000}
            />
          )}
          
          {/* Driver marker */}
          {(() => {
            console.log("=== DRIVER DEBUG ===");
            console.log("driverLocation:", driverLocation);
            console.log("driverId:", driverId);
            console.log("driverPhoto:", driverPhoto);
            console.log("==========================");
            return null;
          })()}
          {driverLocation && (
            <Marker 
              coordinate={driverLocation} 
              pinColor="blue"
              title="Driver"
              description={driverName || "Your driver"}
              zIndex={1000}
            />
          )}
          
          {/* Fallback driver marker if no driver location but we have driver data */}
          {!driverLocation && driverId && (
            <Marker 
              coordinate={{ latitude: 11.5890, longitude: 43.1450 }} 
              pinColor="blue"
              title="Driver"
              description="Driver location unavailable"
            />
          )}
        </MapView>

        {/* Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: THEME.primary }]} />
            <Text style={styles.statusText}>
              {tripPhase === "pickup" ? "Chauffeur en approche" : "En route"}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.locateButton} 
            onPress={() => {
              if (mapRef.current && userLocation) {
                mapRef.current.animateToRegion({
                  ...userLocation,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }, 500);
              }
            }}
          >
            <Ionicons name="locate" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ETA Card */}
        <View style={styles.etaCard}>
          <View style={styles.etaContent}>
            <View style={styles.etaPulse}>
              <Animated.View style={[styles.etaPulseDot, { transform: [{ scale: pulseAnim }] }]} />
            </View>
            <View>
              <Text style={styles.etaTitle}>Arrivée estimée</Text>
              <Text style={styles.etaValue}>{randomETA} min</Text>
            </View>
          </View>
        </View>

        {/* Notification about driver arrival - moved to top */}
        <View style={styles.topNotificationContainer}>
          <View style={styles.notificationIconContainer}>
            <Ionicons name="notifications" size={16} color={THEME.primary} />
          </View>
          <Text style={styles.notificationText}>
            Vous serez contacté lorsque le chauffeur arrivera
          </Text>
        </View>

        {/* Bottom Sheet Overlay */}
        <Animated.View style={[styles.overlayContainer, { height: overlayHeightAnim }]}>
          <View style={styles.overlay}>
            <View style={styles.pullIndicator} />
            
            {/* Always-visible driver info section */}
            <View style={styles.driverInfoContainer}>
              <View style={styles.driverImageWrapper}>
                <Image
                  source={driverPhoto ? { uri: driverPhoto } : require("../assets/driver_placeholder.png")}
                  style={styles.driverImage}
                />
                <View style={styles.ratingContainer}>
                  <Text style={styles.ratingText}>{driverRating}</Text>
                  <Ionicons name="star" size={10} color="#FFD700" />
                </View>
              </View>
              
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{driverName || "Votre chauffeur"}</Text>
                <View style={styles.rideInfoContainer}>
                  <Text style={styles.rideType}>{rideType || "Premium"}</Text>
                </View>
                {driverDistanceToCustomer != null && driverEtaToCustomer != null && (
                  <View style={styles.driverEtaContainer}>
                    <View style={styles.driverEtaItem}>
                      <Feather name="clock" size={14} color={THEME.textMuted} style={styles.etaIcon} />
                      <Text style={styles.driverEtaText}>
                        {Math.ceil(driverEtaToCustomer)} min
                      </Text>
                    </View>
                    <View style={styles.driverEtaItem}>
                      <Feather name="map-pin" size={14} color={THEME.textMuted} style={styles.etaIcon} />
                      <Text style={styles.driverEtaText}>
                        {driverDistanceToCustomer.toFixed(1)} km
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.callButton]}
                onPress={handleCallDriver}
              >
                <Ionicons name="call" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Appeler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={async () => {
                  try {
                    const auth = getAuth();
                    const currentUser = auth.currentUser;
                    
                    if (!currentUser || !driverId) {
                      Alert.alert("Error", "Unable to start conversation");
                      return;
                    }

                    // Create or get the conversation
                    const conversationId = await createDriverCustomerConversation(driverId, currentUser.uid);
                    
                    // Navigate to InboxScreen with the conversation details
                    navigation.navigate('CustomerInboxScreen', {
                      conversationId,
                      driverId,
                      driverName,
                      driverPhoto,
                      rideId
                    });
                  } catch (error) {
                    console.error('Error starting conversation:', error);
                    Alert.alert("Error", "Failed to start conversation");
                  }
                }}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setShowHelpModal(true)}
              >
                <Ionicons name="help-circle" size={20} color={THEME.warning} />
                <Text style={styles.actionButtonText}>Besoin d'aide ?</Text>
              </TouchableOpacity>
            </View>

            {/* Expandable Content */}
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={toggleOverlayExpansion}
              activeOpacity={0.7}
            >
              <View style={styles.expandButtonContent}>
                <Text style={styles.expandButtonText}>
                  {expandedOverlay ? "Voir moins" : "Voir plus"}
                </Text>
                <View style={styles.expandButtonIconContainer}>
                  <Ionicons 
                    name={expandedOverlay ? "chevron-down" : "chevron-up"} 
                    size={16} 
                    color={THEME.primary} 
                  />
                </View>
              </View>
            </TouchableOpacity>

            {/* Expanded Content */}
            <Animated.View style={[styles.expandedContent, { opacity: headerOpacityAnim }]}>
              <ScrollView
                ref={scrollRef}
                style={styles.expandedScroll}
                showsVerticalScrollIndicator={false}
              >
                {/* Trip Details */}
                <View style={styles.tripDetailsContainer}>
                  <Text style={styles.sectionTitle}>Détails du trajet</Text>
                  
                  <View style={styles.tripInfoItem}>
                    <View style={styles.tripInfoIconContainer}>
                      <Ionicons name="map" size={18} color={THEME.primary} />
                    </View>
                    <View style={styles.tripInfoContent}>
                      <Text style={styles.tripInfoLabel}>Distance</Text>
                      <Text style={styles.tripInfoValue}>{distance ? `${distance.toFixed(1)} km` : '-- km'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.tripInfoItem}>
                    <View style={styles.tripInfoIconContainer}>
                      <Ionicons name="time" size={18} color={THEME.primary} />
                    </View>
                    <View style={styles.tripInfoContent}>
                      <Text style={styles.tripInfoLabel}>Durée estimée</Text>
                      <Text style={styles.tripInfoValue}>{duration ? `${Math.ceil(duration)} min` : '-- min'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.tripInfoItem}>
                    <View style={styles.tripInfoIconContainer}>
                      <Ionicons name="card" size={18} color={THEME.primary} />
                    </View>
                    <View style={styles.tripInfoContent}>
                      <Text style={styles.tripInfoLabel}>Tarif</Text>
                      <Text style={styles.tripInfoValue}>{fare ? `${fare} fdj` : '--'}</Text>
                    </View>
                  </View>
                </View>
                
                {/* Vehicle and Safety Section */}
                <View style={styles.safetyContainer}>
                  <Text style={styles.sectionTitle}>Sécurité</Text>
                  
                  <View style={styles.safetyFeature}>
                    <Ionicons name="shield-checkmark" size={18} color={THEME.primary} />
                    <Text style={styles.safetyText}>Chauffeur et véhicule vérifiés</Text>
                  </View>
                  
                  <View style={styles.safetyFeature}>
                    <Ionicons name="location" size={18} color={THEME.primary} />
                    <Text style={styles.safetyText}>Partage de position en temps réel</Text>
                  </View>
                  
                  <View style={styles.safetyFeature}>
                    <Ionicons name="call" size={18} color={THEME.primary} />
                    <Text style={styles.safetyText}>Assistance 24/7</Text>
                  </View>
                </View>
                
                {/* Additional Actions */}
                <View style={styles.additionalActions}>
                  <Text style={styles.sectionTitle}>Actions</Text>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={shareRide}>
                    <View style={styles.actionIconContainer}>
                      <Ionicons name="share-social" size={22} color={THEME.primary} />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionCardTitle}>Partager le trajet</Text>
                      <Text style={styles.actionCardDescription}>Informez vos proches de votre itinéraire</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={THEME.textMuted} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={textDriver}>
                    <View style={styles.actionIconContainer}>
                      <Ionicons name="chatbubble" size={22} color={THEME.primary} />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionCardTitle}>SMS au chauffeur</Text>
                      <Text style={styles.actionCardDescription}>Envoyer un message texte</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={THEME.textMuted} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={openCavalContact}>
                    <View style={styles.actionIconContainer}>
                      <Ionicons name="help-circle" size={22} color={THEME.primary} />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text style={styles.actionCardTitle}>Contacter le support</Text>
                      <Text style={styles.actionCardDescription}>Besoin d'aide avec votre trajet?</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={THEME.textMuted} />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </Animated.View>
        
        {/* Help Modal for reasons */}
        <Modal
          visible={showHelpModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowHelpModal(false)}
        >
          <BlurView intensity={95} style={styles.modalBlurContainer} tint="dark">
            <View style={styles.modalContainer}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <MaterialIcons name="help-outline" size={40} color={THEME.warning} />
                  <Text style={styles.modalTitle}>Pourquoi avez-vous besoin d'aide ?</Text>
                </View>
                <View style={{ marginVertical: 20 }}>
                  {[
                    "Le chauffeur ne se présente pas",
                    "Problème avec le véhicule",
                    "Changement de destination",
                    "Autre"
                  ].map((reason, idx) => (
                    <TouchableOpacity
                      key={reason}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 15,
                        backgroundColor: selectedReason === reason ? THEME.primary : 'transparent',
                        borderRadius: 8,
                        padding: 10,
                      }}
                      onPress={() => setSelectedReason(reason)}
                    >
                      <Ionicons name={selectedReason === reason ? 'radio-button-on' : 'radio-button-off'} size={22} color={THEME.primary} style={{ marginRight: 10 }} />
                      <Text style={{ color: THEME.text, fontSize: 16 }}>{reason}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => { setShowHelpModal(false); setSelectedReason(null); }}
                  >
                    <Text style={styles.modalButtonText}>Retour</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirmButton]}
                    onPress={() => { if (selectedReason) { setShowHelpModal(false); setShowConfirmModal(true); } }}
                    disabled={!selectedReason}
                  >
                    <Text style={styles.modalButtonText}>Continuer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </BlurView>
        </Modal>

        {/* Confirm Cancel Modal */}
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <BlurView intensity={95} style={styles.modalBlurContainer} tint="dark">
            <View style={styles.modalContainer}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <MaterialIcons name="error-outline" size={40} color={THEME.warning} />
                  <Text style={styles.modalTitle}>Annuler la course ?</Text>
                </View>
                <Text style={styles.modalMessage}>
                  Annuler plus de 3 fois entraînera le bannissement de votre compte Caval.
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={() => { setShowConfirmModal(false); setSelectedReason(null); }}
                    disabled={isCancelling}
                  >
                    <Text style={styles.modalButtonText}>Retour</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirmButton]}
                    onPress={async () => {
                      setShowConfirmModal(false);
                      await handleCancelRide(selectedReason);
                      setSelectedReason(null);
                    }}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalButtonText}>Confirmer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </BlurView>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: THEME.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingGradient: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "800",
    color: THEME.primary,
    letterSpacing: 3,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: THEME.text,
    marginTop: 20,
    textAlign: "center",
  },
  loadingSubtext: {
    fontSize: 14,
    color: THEME.textMuted,
    marginTop: 10,
    textAlign: "center",
    maxWidth: "80%",
  },
  
  // Map Markers
  userLocationMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  userLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4285F4",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userLocationRing: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(66, 133, 244, 0.5)",
  },
  originMarkerContainer: {
    alignItems: "center",
    backgroundColor: 'transparent',
  },
  originMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.primary,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  markerAddressPill: {
    backgroundColor: "rgba(30, 30, 30, 0.85)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    fontSize: 10,
    color: "#FFFFFF",
    marginTop: 6,
    overflow: "hidden",
    maxWidth: 120,
    textAlign: "center",
  },
  destinationPinContainer: {
    alignItems: "center",
    backgroundColor: 'transparent',
    elevation: 10,
  },
  pinShadow: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    top: 2,
    elevation: 5,
  },
  pinBody: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  pinHead: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  pinTail: {
    position: "absolute",
    bottom: -8,
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: THEME.primary,
  },
  pinAddressContainer: {
    position: "absolute",
    bottom: -35,
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    maxWidth: 150,
  },
  pinAddressText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  driverMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
  },
  driverMarkerHalo: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 107, 0, 0.2)",
    elevation: 5,
  },
  driverMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  driverMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  
  // Top Controls
  topControls: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  locateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  // ETA Card
  etaCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 110 : 100,
    left: 16,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 3,
    borderLeftColor: THEME.primary,
  },
  etaContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  etaPulse: {
    marginRight: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 107, 0, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  etaPulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.primary,
  },
  etaTitle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 2,
  },
  etaValue: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.text,
  },
  
  // Notification about driver arrival - moved to top
  topNotificationContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 110 : 100,
    right: 16,
    left: 200,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 107, 0, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
    fontSize: 14,
    color: THEME.text,
    fontWeight: "500",
    lineHeight: 20,
  },
  
  // Bottom Overlay
  overlayContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: COLLAPSED_HEIGHT,
    transform: [{ translateY: 0 }],
  },
  overlay: {
    flex: 1,
    backgroundColor: THEME.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
    padding: 16,
  },
  pullIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: THEME.cardLight,
    alignSelf: "center",
    marginBottom: 12,
  },
  
  // Driver Info Section
  driverInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 20 : 8,
  },
  driverImageWrapper: {
    position: "relative",
    marginRight: 15,
  },
  driverImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: THEME.primary,
  },
  ratingContainer: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: THEME.card,
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.primary,
  },
  ratingText: {
    color: THEME.text,
    fontWeight: "600",
    fontSize: 12,
    marginRight: 2,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.text,
    marginBottom: 4,
  },
  rideInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  rideType: {
    fontSize: 14,
    color: THEME.textSecondary,
    backgroundColor: THEME.cardLight,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  driverEtaContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverEtaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  etaIcon: {
    marginRight: 4,
  },
  driverEtaText: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  
  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Platform.OS === "ios" ? 16 : 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.cardLight,
    borderRadius: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 6,
    marginHorizontal: 4,
  },
  callButton: {
    backgroundColor: THEME.primary + "22",
  },
  actionButtonText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: Platform.OS === "ios" ? 6 : 3,
  },
  
  // Expand Section
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Platform.OS === "ios" ? 12 : 4,
    paddingHorizontal: 16,
    backgroundColor: THEME.cardLight,
    borderRadius: 12,
    marginTop: Platform.OS === "ios" ? 8 : 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 0, 0.2)",
  },
  expandButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  expandButtonText: {
    color: THEME.primary,
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
  },
  expandButtonIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  
  // Expanded Content
  expandedContent: {
    flex: 1,
    opacity: 0,
  },
  expandedScroll: {
    flex: 1,
  },
  
  // Trip Details
  tripDetailsContainer: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.text,
    marginBottom: 12,
  },
  tripInfoItem: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "center",
  },
  tripInfoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  tripInfoContent: {
    flex: 1,
  },
  tripInfoLabel: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 2,
  },
  tripInfoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.text,
  },
  
  // Safety Section
  safetyContainer: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  safetyFeature: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  safetyText: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginLeft: 10,
  },
  
  // Additional Actions
  additionalActions: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.cardLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: THEME.text,
    marginBottom: 2,
  },
  actionCardDescription: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  
  // Modal
  modalBlurContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "85%",
    borderRadius: 20,
    overflow: "hidden",
  },
  modalCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: THEME.text,
    marginTop: 12,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: THEME.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  modalCancelButton: {
    backgroundColor: THEME.cardLight,
  },
  modalConfirmButton: {
    backgroundColor: THEME.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  }
});

export default DriverFoundScreen;