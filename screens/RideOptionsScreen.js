import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TextInput,
  FlatList,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, getDoc, doc } from "firebase/firestore";
import { firestore } from "../firebase.config";
import { getAuth } from "firebase/auth";

// Your custom pin and Caval Moto icon
import CustomPin from "../assets/CustomPin.png";
import CavalMotoIcon from "../assets/clipart1667936.png";

// Use the same API key as HomeScreenWithMap
const GOOGLE_API_KEY = 'AIzaSyBnVN-ACYzcA0Sy8BcPLpXG50Y9T8jhJGE';

const RideOptionsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();

  // Hide default navigation header
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Retrieve origin and destination (including addresses) from HomeScreenWithMap
  const { origin, destination, customerFirstName, customerPhoto, customerPhone, distance: passedDistance } = route.params || {};

  // Reference for MapView
  const mapRef = useRef(null);

  // State to store route coordinates (for recentering)
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  // Location editing states
  const [isEditingLocations, setIsEditingLocations] = useState(false);
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [editingDestination, setEditingDestination] = useState(false);
  const [modifiedOrigin, setModifiedOrigin] = useState(origin);
  const [modifiedDestination, setModifiedDestination] = useState(destination);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [originAutocompleteVisible, setOriginAutocompleteVisible] = useState(false);
  const [destinationAutocompleteVisible, setDestinationAutocompleteVisible] = useState(false);
  const [originSearchText, setOriginSearchText] = useState("");
  const [destinationSearchText, setDestinationSearchText] = useState("");
  const [originSearchResults, setOriginSearchResults] = useState([]);
  const [destinationSearchResults, setDestinationSearchResults] = useState([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);

  // Pin dropping states
  const [selectionMode, setSelectionMode] = useState(null); // 'pickup' or 'dropoff' or null
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [isFullScreenMap, setIsFullScreenMap] = useState(false);

  // Refs for GooglePlacesAutocomplete
  const originAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);

  // Fallback initial region
  const initialRegion = {
    latitude: origin && destination 
      ? (origin.latitude + destination.latitude) / 2 
      : (origin?.latitude || 37.7749),
    longitude: origin && destination 
      ? (origin.longitude + destination.longitude) / 2 
      : (origin?.longitude || -122.4194),
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // States for distance, duration, and fares
  const [distance, setDistance] = useState(
    typeof passedDistance === 'number' && !isNaN(passedDistance) ? passedDistance : 0
  ); // km - use passed distance as initial value
  const [duration, setDuration] = useState(0); // minutes
  const [cavalPriveFare, setCavalPriveFare] = useState(0);
  const [cavalMotoFare, setCavalMotoFare] = useState(0);
  
  // Payment method states
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedRideType, setSelectedRideType] = useState(null);

  // Add state to store bottom sheet height
  const [bottomSheetHeight, setBottomSheetHeight] = useState(350);

  // Load payment methods on screen load and calculate initial fares
  useEffect(() => {
    fetchPaymentMethods();
    
    // Calculate initial fares using passed distance
    if (passedDistance) {
      const cavalPriveFare = calculateFare(passedDistance, 'Caval Privé');
      const cavalMotoFare = calculateFare(passedDistance, 'Caval moto');
      setCavalPriveFare(cavalPriveFare);
      setCavalMotoFare(cavalMotoFare);
    }
  }, [passedDistance]);

  // Keyboard listeners for location editing
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    });
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Format arrival time (e.g., "3:15 PM")
  const getFormattedArrivalTime = (extraMinutes) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + extraMinutes);
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const paddedMinutes = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${paddedMinutes} ${ampm}`;
  };

  // When directions are ready, update metrics and fares (only if MapViewDirections provides better data)
  const handleDirectionsReady = (result) => {
    setRouteCoordinates(result.coordinates);
    
    // Only update distance if MapViewDirections provides a valid distance and it's different from passed distance
    if (result.distance && result.distance > 0) {
      setDistance(result.distance);
    }
    
    setDuration(result.duration);
    
    // Calculate fares using the current distance
    const currentDistance = result.distance && result.distance > 0 ? result.distance : (passedDistance || 0);
    const cavalPriveFare = calculateFare(currentDistance, 'Caval Privé');
    const cavalMotoFare = calculateFare(currentDistance, 'Caval moto');
    
    setCavalPriveFare(cavalPriveFare);
    setCavalMotoFare(cavalMotoFare);
    
    // Center the map on the route when directions are ready
    if (result.coordinates && result.coordinates.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(result.coordinates, {
        edgePadding: {
          top: 60,
          right: 40,
          bottom: bottomSheetHeight,
          left: 40,
        },
        animated: true,
      });
    }
  };

  // Function to recenter the map on the route
  const recenterMap = () => {
    if (origin && destination) {
      // Shift the center point upward by adjusting the latitude
      const centerLat = ((origin.latitude + destination.latitude) / 2) - 0.05; // Reduced offset to 0.05
      const centerLng = (origin.longitude + destination.longitude) / 2;
      
      // Calculate the appropriate zoom level based on distance with more padding
      const latDelta = Math.abs(origin.latitude - destination.latitude) * 2.5;
      const lngDelta = Math.abs(origin.longitude - destination.longitude) * 2.5;
      
      mapRef.current?.animateToRegion({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: Math.max(latDelta, 0.03),
        longitudeDelta: Math.max(lngDelta, 0.03),
      }, 1000);
    }
  };

  // Create ride request in Firestore
  const createRideRequest = async (selectedRideType, selectedFare) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      Alert.alert("Erreur", "Vous devez être connecté pour créer une demande de course.");
      navigation.navigate("LoginScreen");
      return null;
    }
    
    const userId = currentUser.uid;
    try {
      // Get customer data from Firestore
      const customerDoc = await getDoc(doc(firestore, "Customers", userId));
      const customerData = customerDoc.exists() ? customerDoc.data() : null;

      // Create the main ride request document
      const rideRequestDoc = await addDoc(collection(firestore, "rideRequests"), {
        userId,
        pickupLat: (modifiedOrigin || origin).latitude,
        pickupLng: (modifiedOrigin || origin).longitude,
        destinationLat: (modifiedDestination || destination).latitude,
        destinationLng: (modifiedDestination || destination).longitude,
        rideType: selectedRideType,
        fare: selectedFare,
        distance,
        duration,
        status: "waiting",
        paymentMethod: selectedPaymentMethod ? selectedPaymentMethod.id : "",
        createdAt: serverTimestamp(),
        // Add driver fields with initial null values
        driverId: null,
        driverName: null,
        driverPhoto: null,
        driverPhone: null,
        assignedAt: null
      });

      // Create a document in rideRequestsDriver collection with customer information
      await addDoc(collection(firestore, "rideRequestsDriver"), {
        rideRequestId: rideRequestDoc.id,
        number: customerData?.number || null,
        photo: customerData?.photo || null,
        firstName: customerData?.firstName || "Client",
        createdAt: serverTimestamp()
      });

      return rideRequestDoc.id;
    } catch (error) {
      console.error("Erreur lors de la création de la demande de course :", error);
      return null;
    }
  };

  // Fetch payment methods from Firestore
  const fetchPaymentMethods = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        const userId = currentUser.uid;
        const paymentMethodsQuery = query(
          collection(firestore, "paymentMethods"),
          where("userId", "==", userId),
          limit(10)
        );
        
        const querySnapshot = await getDocs(paymentMethodsQuery);
        const methods = [];
        
        querySnapshot.forEach((doc) => {
          methods.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        
        setPaymentMethods(methods);
        
        // Set the default payment method if available
        if (methods.length > 0) {
          const defaultMethod = methods.find(method => method.isDefault) || methods[0];
          setSelectedPaymentMethod(defaultMethod);
        }
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    }
  };

  // Handle initial ride selection before confirming payment
  const handleRideSelection = (rideType) => {
    setSelectedRideType(rideType);
    setPaymentModalVisible(true);
  };

  // Complete the ride request after payment method selection
  const completeRideRequest = async () => {
    let selectedFare = 0;
    if (selectedRideType === "Caval Privé") {
      selectedFare = cavalPriveFare;
    } else if (selectedRideType === "Caval moto") {
      selectedFare = cavalMotoFare;
    }

    const rideRequestId = await createRideRequest(selectedRideType, selectedFare);
    if (rideRequestId) {
      setPaymentModalVisible(false);
      navigation.navigate("FindingDriverScreen", {
        rideType: selectedRideType,
        distance,
        duration,
        rideRequestId,
        origin: route.params.origin,
        destination: route.params.destination,
        paymentMethod: selectedPaymentMethod ? selectedPaymentMethod.type : "cash",
      });
    } else {
      alert("Erreur lors de la création de la demande. Veuillez réessayer.");
    }
  };

  // Render payment method item
  const renderPaymentMethod = (method, index) => {
    const isSelected = selectedPaymentMethod && selectedPaymentMethod.id === method.id;
    
    let icon = "cash";
    if (method.type === "card") {
      icon = "credit-card";
    } else if (method.type === "mobile") {
      icon = "phone";
    }
    
    return (
      <TouchableOpacity
        key={method.id || index}
        style={[
          styles.paymentMethodItem,
          isSelected && styles.selectedPaymentMethod
        ]}
        onPress={() => setSelectedPaymentMethod(method)}
      >
        <MaterialCommunityIcons name={icon} size={24} color="#FF6F00" />
        <Text style={styles.paymentMethodTitle}>
          {method.title || method.type}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#FF6F00" />
        )}
      </TouchableOpacity>
    );
  };

  // Updated fare calculation function with the new pricing structure
  const calculateFare = (distance, rideType) => {
    const distanceInKm = distance; // Distance is already in kilometers
    let baseFare = 0;
    let additionalFare = 0;

    if (rideType === 'Caval Privé') {
      baseFare = 400; // Initial price for 3km or less
      if (distanceInKm > 3) {
        // Calculate additional distance in 0.5km increments
        const additionalDistance = distanceInKm - 3;
        const halfKmIncrements = Math.ceil(additionalDistance / 0.5);
        additionalFare = halfKmIncrements * 50;
      }
    } else if (rideType === 'Caval moto') {
      baseFare = 150; // Initial price for 3km or less
      if (distanceInKm > 3) {
        // Calculate additional distance in 0.5km increments
        const additionalDistance = distanceInKm - 3;
        const halfKmIncrements = Math.ceil(additionalDistance / 0.5);
        additionalFare = halfKmIncrements * 50;
      }
    }

    const totalFare = baseFare + additionalFare;
    // Round to the nearest 50
    return Math.round(totalFare / 50) * 50;
  };

  // Handle origin selection
  const handleOriginSelect = async (data, details = null) => {
    try {
      if (!details) {
        console.error("Détails non trouvés pour l'origine sélectionnée");
        return;
      }
      const location = details.geometry.location;
      const newOrigin = { 
        latitude: location.lat, 
        longitude: location.lng, 
        address: data.description 
      };
      setModifiedOrigin(newOrigin);
      setEditingOrigin(false);
      
      // Recalculate route and fares
      if (modifiedDestination) {
        const newDistance = calculateDistance(newOrigin, modifiedDestination);
        setDistance(newDistance);
        const cavalPriveFare = calculateFare(newDistance, 'Caval Privé');
        const cavalMotoFare = calculateFare(newDistance, 'Caval moto');
        setCavalPriveFare(cavalPriveFare);
        setCavalMotoFare(cavalMotoFare);
      }
    } catch (error) {
      console.error("Erreur lors de la sélection de l'origine :", error);
    }
  };

  // Handle destination selection
  const handleDestinationSelect = async (data, details = null) => {
    try {
      if (!details) {
        console.error("Détails non trouvés pour la destination sélectionnée");
        return;
      }
      const location = details.geometry.location;
      const newDestination = { 
        latitude: location.lat, 
        longitude: location.lng, 
        address: data.description 
      };
      setModifiedDestination(newDestination);
      setEditingDestination(false);
      
      // Recalculate route and fares
      if (modifiedOrigin) {
        const newDistance = calculateDistance(modifiedOrigin, newDestination);
        setDistance(newDistance);
        const cavalPriveFare = calculateFare(newDistance, 'Caval Privé');
        const cavalMotoFare = calculateFare(newDistance, 'Caval moto');
        setCavalPriveFare(cavalPriveFare);
        setCavalMotoFare(cavalMotoFare);
      }
    } catch (error) {
      console.error("Erreur lors de la sélection de la destination :", error);
    }
  };

  // Calculate distance between two points
  const calculateDistance = (origin, destination) => {
    const R = 6371; // Earth's radius in kilometers
    const lat1 = origin.latitude * Math.PI / 180;
    const lat2 = destination.latitude * Math.PI / 180;
    const deltaLat = (destination.latitude - origin.latitude) * Math.PI / 180;
    const deltaLon = (destination.longitude - origin.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return parseFloat(distance.toFixed(1)); // Return distance as a number with 1 decimal place
  };

  // Search places function
  const searchPlaces = async (query, isOrigin = true) => {
    if (query.length < 2) {
      if (isOrigin) {
        setOriginSearchResults([]);
        setOriginAutocompleteVisible(false);
      } else {
        setDestinationSearchResults([]);
        setDestinationAutocompleteVisible(false);
      }
      return;
    }

    try {
      if (isOrigin) {
        setIsSearchingOrigin(true);
      } else {
        setIsSearchingDestination(true);
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=fr&components=country:DJ`
      );
      const data = await response.json();

      if (data.status === "OK" && data.predictions) {
        if (isOrigin) {
          setOriginSearchResults(data.predictions);
          setOriginAutocompleteVisible(true);
        } else {
          setDestinationSearchResults(data.predictions);
          setDestinationAutocompleteVisible(true);
        }
      }
    } catch (error) {
      console.error("Error searching places:", error);
    } finally {
      if (isOrigin) {
        setIsSearchingOrigin(false);
      } else {
        setIsSearchingDestination(false);
      }
    }
  };

  // Handle place selection
  const handlePlaceSelect = async (place, isOrigin = true) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${GOOGLE_API_KEY}&fields=geometry,formatted_address`
      );
      const data = await response.json();

      if (data.status === "OK" && data.result) {
        const location = data.result.geometry.location;
        const address = data.result.formatted_address;

        if (isOrigin) {
          const newOrigin = { 
            latitude: location.lat, 
            longitude: location.lng, 
            address: address 
          };
          setModifiedOrigin(newOrigin);
          setEditingOrigin(false);
          setOriginSearchText("");
          setOriginAutocompleteVisible(false);
          
          // Recalculate route and fares
          if (modifiedDestination) {
            const newDistance = calculateDistance(newOrigin, modifiedDestination);
            setDistance(newDistance);
            const cavalPriveFare = calculateFare(newDistance, 'Caval Privé');
            const cavalMotoFare = calculateFare(newDistance, 'Caval moto');
            setCavalPriveFare(cavalPriveFare);
            setCavalMotoFare(cavalMotoFare);
          }
        } else {
          const newDestination = { 
            latitude: location.lat, 
            longitude: location.lng, 
            address: address 
          };
          setModifiedDestination(newDestination);
          setEditingDestination(false);
          setDestinationSearchText("");
          setDestinationAutocompleteVisible(false);
          
          // Recalculate route and fares
          if (modifiedOrigin) {
            const newDistance = calculateDistance(modifiedOrigin, newDestination);
            setDistance(newDistance);
            const cavalPriveFare = calculateFare(newDistance, 'Caval Privé');
            const cavalMotoFare = calculateFare(newDistance, 'Caval moto');
            setCavalPriveFare(cavalPriveFare);
            setCavalMotoFare(cavalMotoFare);
          }
        }
      }
    } catch (error) {
      console.error("Error getting place details:", error);
    }
  };

  // Pin dropping functions
  const startLocationSelection = (mode) => {
    setSelectionMode(mode);
    setSelectedLocation(null);
    setIsFullScreenMap(true);
    
    // Set initial region for full-screen mode
    setTimeout(() => {
      if (mapRef.current) {
        const currentOrigin = modifiedOrigin || origin;
        const currentDestination = modifiedDestination || destination;
        
        if (currentOrigin && currentDestination) {
          // Center between origin and destination
          const centerLat = (currentOrigin.latitude + currentDestination.latitude) / 2;
          const centerLng = (currentOrigin.longitude + currentDestination.longitude) / 2;
          
          mapRef.current.animateToRegion({
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }, 500);
        } else if (currentOrigin) {
          // Center on origin
          mapRef.current.animateToRegion({
            latitude: currentOrigin.latitude,
            longitude: currentOrigin.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 500);
        }
      }
    }, 100);
  };

  const handleCancelSelection = () => {
    setSelectionMode(null);
    setSelectedLocation(null);
    setIsFullScreenMap(false);
  };

  const handleMapPress = async (event) => {
    if (!selectionMode) return;

    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinate.latitude},${coordinate.longitude}&key=${GOOGLE_API_KEY}`,
        {
          signal: controller.signal,
          timeout: 10000
        }
      );
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (data.status === "OK" && data.results && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        setSearchText(address);
        
        if (selectionMode === 'pickup') {
          const newOrigin = {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: address
          };
          setModifiedOrigin(newOrigin);
          
          // Recalculate route and fares
          if (modifiedDestination || destination) {
            const newDistance = calculateDistance(newOrigin, modifiedDestination || destination);
            setDistance(newDistance);
            const cavalPriveFare = calculateFare(newDistance, 'Caval Privé');
            const cavalMotoFare = calculateFare(newDistance, 'Caval moto');
            setCavalPriveFare(cavalPriveFare);
            setCavalMotoFare(cavalMotoFare);
          }
        } else if (selectionMode === 'dropoff') {
          const newDestination = {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: address
          };
          setModifiedDestination(newDestination);
          
          // Recalculate route and fares
          if (modifiedOrigin || origin) {
            const newDistance = calculateDistance(modifiedOrigin || origin, newDestination);
            setDistance(newDistance);
            const cavalPriveFare = calculateFare(newDistance, 'Caval Privé');
            const cavalMotoFare = calculateFare(newDistance, 'Caval moto');
            setCavalPriveFare(cavalPriveFare);
            setCavalMotoFare(cavalMotoFare);
          }
        }
        
        setSelectionMode(null);
        setIsFullScreenMap(false);
        mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error("Request timed out");
        Alert.alert("Erreur", "La requête a expiré. Veuillez réessayer.");
      } else {
        console.error("Error reverse geocoding:", error);
        Alert.alert("Erreur", "Impossible de trouver l'adresse à cet emplacement.");
      }
    }
  };

  const handleRegionChangeComplete = async (newRegion) => {
    if (selectionMode) {
      setSelectedLocation({
        latitude: newRegion.latitude,
        longitude: newRegion.longitude
      });

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${newRegion.latitude},${newRegion.longitude}&key=${GOOGLE_API_KEY}`,
          {
            signal: controller.signal,
            timeout: 10000
          }
        );
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (data.status === "OK" && data.results && data.results.length > 0) {
          const address = data.results[0].formatted_address;
          setSearchText(address);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error("Request timed out");
        } else {
          console.error("Error reverse geocoding:", error);
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      {isFullScreenMap ? (
        // Full Screen Map Mode
        <View style={styles.fullScreenContainer}>
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.fullScreenBackButton} 
            onPress={handleCancelSelection}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Map Section */}
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            rotateEnabled={false}
            scrollEnabled={true}
            zoomEnabled={true}
            pitchEnabled={false}
            onPress={handleMapPress}
            onRegionChangeComplete={handleRegionChangeComplete}
          >
            {/* Origin Marker */}
            {(modifiedOrigin || origin) && (
              <Marker coordinate={modifiedOrigin || origin} title="Point de départ">
                <View style={{
                  backgroundColor: '#FF6F00',
                  padding: 8,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: '#fff',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                }}>
                  <Ionicons name="location" size={20} color="#fff" />
                </View>
              </Marker>
            )}

            {/* Destination Marker */}
            {(modifiedDestination || destination) && (
              <Marker coordinate={modifiedDestination || destination} title="Destination">
                <View style={{
                  backgroundColor: '#4CAF50',
                  padding: 8,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: '#fff',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                }}>
                  <Ionicons name="flag" size={20} color="#fff" />
                </View>
              </Marker>
            )}
          </MapView>

          {/* Fixed pin overlay in the center when in selection mode */}
          {selectionMode && (
            <View pointerEvents="none" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: -24,
              marginTop: -48,
              zIndex: 20,
            }}>
              <View style={{
                backgroundColor: '#fff',
                borderRadius: 24,
                padding: 2,
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 4,
                elevation: 5,
              }}>
                <View style={{
                  backgroundColor: '#FF6F00',
                  borderRadius: 20,
                  padding: 8,
                  borderWidth: 2,
                  borderColor: '#fff',
                }}>
                  <Ionicons 
                    name="location" 
                    size={32} 
                    color="#fff" 
                    style={{ 
                      opacity: 0.95,
                    }} 
                  />
                </View>
              </View>
            </View>
          )}

          {/* Selection mode bottom sheet */}
          {selectionMode && (
            <View style={styles.fullScreenSelectionBottomSheet}>
              <View style={{
                backgroundColor: '#1E1E1E',
                borderTopLeftRadius: 25,
                borderTopRightRadius: 25,
                paddingVertical: 20,
                paddingHorizontal: 20,
                paddingBottom: Platform.OS === 'ios' ? 40 : 20,
                height: 350,
              }}>
                <Text style={styles.selectionTitle}>
                  {selectionMode === 'pickup' ? 'Définissez votre point de départ' : 'Définissez votre destination'}
                </Text>
                <Text style={styles.selectionSubtitle}>Faites glisser la carte pour déplacer l'épingle</Text>
                <View style={styles.selectionSearchBar}>
                  <Ionicons name="location-outline" size={20} color="#FF6F00" style={{ marginLeft: 8 }} />
                  <Text style={styles.selectionSearchText}>{searchText || 'Rechercher un lieu'}</Text>
                  <TouchableOpacity style={{ marginRight: 8 }}>
                    <Ionicons name="search" size={20} color="#FF6F00" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={styles.selectionConfirmButton} 
                  onPress={() => handleMapPress({ nativeEvent: { coordinate: selectedLocation || { latitude: 0, longitude: 0 } } })}
                >
                  <Text style={styles.selectionConfirmButtonText}>
                    Confirmer {selectionMode === 'pickup' ? 'le point de départ' : 'la destination'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.selectionCancelButton} onPress={handleCancelSelection}>
                  <Text style={styles.selectionCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : (
        // Normal Interface
        <>
          {/* Back Button */}
          <View style={styles.backButtonContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={28} color="#FF6F00" />
            </TouchableOpacity>
          </View>

          {/* Recenter Button */}
          <View style={styles.recenterButtonContainer}>
            <TouchableOpacity onPress={recenterMap}>
              <Ionicons name="locate" size={28} color="#FF6F00" />
            </TouchableOpacity>
          </View>

          {/* Map Section */}
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            rotateEnabled={false}
            mapPadding={{ top: 250, right: 0, bottom: 350, left: 0 }}
            scrollEnabled={true}
            zoomEnabled={true}
            pitchEnabled={false}
          >
            {/* Origin Marker */}
            {(modifiedOrigin || origin) && (
              <Marker coordinate={modifiedOrigin || origin} title="Point de départ">
                <View style={{
                  backgroundColor: '#FF6F00',
                  padding: 8,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: '#fff',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                }}>
                  <Ionicons name="location" size={20} color="#fff" />
                </View>
              </Marker>
            )}

            {/* Destination Marker */}
            {(modifiedDestination || destination) && (
              <Marker coordinate={modifiedDestination || destination} title="Destination">
                <View style={{
                  backgroundColor: '#4CAF50',
                  padding: 8,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: '#fff',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                }}>
                  <Ionicons name="flag" size={20} color="#fff" />
                </View>
              </Marker>
            )}
            
            {/* Route Directions */}
            {(modifiedOrigin || origin) && (modifiedDestination || destination) && (
              <MapViewDirections
                origin={modifiedOrigin || origin}
                destination={modifiedDestination || destination}
                apikey={GOOGLE_API_KEY}
                strokeWidth={4}
                strokeColor="#FF6F00"
                onReady={handleDirectionsReady}
              />
            )}
          </MapView>
          
          {/* Fixed pin overlay in the center when in selection mode */}
          {selectionMode && (
            <View pointerEvents="none" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: -24,
              marginTop: -48,
              zIndex: 20,
            }}>
              <View style={{
                backgroundColor: '#fff',
                borderRadius: 24,
                padding: 2,
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 4,
                elevation: 5,
              }}>
                <View style={{
                  backgroundColor: '#FF6F00',
                  borderRadius: 20,
                  padding: 8,
                  borderWidth: 2,
                  borderColor: '#fff',
                }}>
                  <Ionicons 
                    name="location" 
                    size={32} 
                    color="#fff" 
                    style={{ 
                      opacity: 0.95,
                    }} 
                  />
                </View>
              </View>
            </View>
          )}

          {/* Back button in selection mode */}
          {selectionMode && (
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleCancelSelection}
            >
              <Ionicons 
                name="arrow-back" 
                size={24} 
                color="#fff" 
              />
            </TouchableOpacity>
          )}

          {/* Ride Options Panel */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
          >
            <View
              style={[
                styles.bottomSheet,
                {
                  bottom: keyboardVisible ? (Platform.OS === 'ios' ? 1 : keyboardHeight - 50) : 0,
                }
              ]}
              onLayout={e => {
                const { height } = e.nativeEvent.layout;
                setBottomSheetHeight(height);
              }}
            >
              <View style={styles.headerContainer}>
                <Text style={styles.headerText}>Choisissez votre trajet</Text>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => setIsEditingLocations(!isEditingLocations)}
                >
                  <Ionicons 
                    name={isEditingLocations ? "checkmark" : "create-outline"} 
                    size={24} 
                    color="#FF6F00" 
                  />
                </TouchableOpacity>
              </View>
              
              {/* Route Summary */}
              <View style={styles.routeSummaryContainer}>
                {/* Origin Point */}
                <View style={styles.routePoint}>
                  <View style={styles.routeDot} />
                  {isEditingLocations && editingOrigin ? (
                    <View style={styles.autocompleteContainer}>
                      <TextInput
                        style={styles.customTextInput}
                        placeholder="Modifier le point de départ"
                        placeholderTextColor="#6B7280"
                        value={originSearchText}
                        onChangeText={(text) => {
                          setOriginSearchText(text);
                          searchPlaces(text, true);
                        }}
                        onFocus={() => setOriginAutocompleteVisible(true)}
                      />
                      {originAutocompleteVisible && originSearchResults.length > 0 && (
                        <View style={styles.customDropdown}>
                          <FlatList
                            data={originSearchResults}
                            keyExtractor={(item, index) => `origin-${index}`}
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={styles.dropdownItem}
                                onPress={() => handlePlaceSelect(item, true)}
                              >
                                <Text style={styles.dropdownItemText}>{item.description}</Text>
                              </TouchableOpacity>
                            )}
                            showsVerticalScrollIndicator={true}
                            maxHeight={150}
                          />
                        </View>
                      )}
                      <TouchableOpacity 
                        style={styles.cancelEditButton}
                        onPress={() => {
                          setEditingOrigin(false);
                          setOriginSearchText("");
                          setOriginAutocompleteVisible(false);
                        }}
                      >
                        <Ionicons name="close" size={16} color="#FF6F00" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.locationContainer}>
                      <Text style={styles.routeText} numberOfLines={1}>
                        {modifiedOrigin?.address || origin?.address || "Point de départ"}
                      </Text>
                      {isEditingLocations && (
                        <View style={styles.locationButtons}>
                          <TouchableOpacity 
                            style={styles.editLocationButton}
                            onPress={() => setEditingOrigin(true)}
                          >
                            <Ionicons name="create-outline" size={16} color="#FF6F00" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.pinDropButton}
                            onPress={() => startLocationSelection('pickup')}
                          >
                            <Ionicons name="location" size={16} color="#FF6F00" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                
                <View style={styles.routeLine} />
                
                {/* Destination Point */}
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, styles.routeDotDestination]} />
                  {isEditingLocations && editingDestination ? (
                    <View style={styles.autocompleteContainer}>
                      <TextInput
                        style={styles.customTextInput}
                        placeholder="Modifier la destination"
                        placeholderTextColor="#6B7280"
                        value={destinationSearchText}
                        onChangeText={(text) => {
                          setDestinationSearchText(text);
                          searchPlaces(text, false);
                        }}
                        onFocus={() => setDestinationAutocompleteVisible(true)}
                      />
                      {destinationAutocompleteVisible && destinationSearchResults.length > 0 && (
                        <View style={styles.customDropdown}>
                          <FlatList
                            data={destinationSearchResults}
                            keyExtractor={(item, index) => `destination-${index}`}
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={styles.dropdownItem}
                                onPress={() => handlePlaceSelect(item, false)}
                              >
                                <Text style={styles.dropdownItemText}>{item.description}</Text>
                              </TouchableOpacity>
                            )}
                            showsVerticalScrollIndicator={true}
                            maxHeight={150}
                          />
                        </View>
                      )}
                      <TouchableOpacity 
                        style={styles.cancelEditButton}
                        onPress={() => {
                          setEditingDestination(false);
                          setDestinationSearchText("");
                          setDestinationAutocompleteVisible(false);
                        }}
                      >
                        <Ionicons name="close" size={16} color="#FF6F00" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.locationContainer}>
                      <Text style={styles.routeText} numberOfLines={1}>
                        {modifiedDestination?.address || destination?.address || "Destination"}
                      </Text>
                      {isEditingLocations && (
                        <View style={styles.locationButtons}>
                          <TouchableOpacity 
                            style={styles.editLocationButton}
                            onPress={() => setEditingDestination(true)}
                          >
                            <Ionicons name="create-outline" size={16} color="#FF6F00" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.pinDropButton}
                            onPress={() => startLocationSelection('dropoff')}
                          >
                            <Ionicons name="location" size={16} color="#FF6F00" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.divider} />
              
              {/* Ride Option Components */}
              <RideOption
                rideType="Caval Privé"
                iconName="car"
                arrivalTime={getFormattedArrivalTime(duration)}
                distance={typeof distance === 'number' && !isNaN(distance) ? distance.toFixed(1) : 'N/A'}
                fare={cavalPriveFare}
                onSelect={() => handleRideSelection("Caval Privé")}
              />

              <RideOption
                rideType="Caval moto"
                iconName="motorbike"
                arrivalTime={getFormattedArrivalTime(duration)}
                distance={typeof distance === 'number' && !isNaN(distance) ? distance.toFixed(1) : 'N/A'}
                fare={cavalMotoFare}
                onSelect={() => handleRideSelection("Caval moto")}
                useMotoImage
                maxPeople={1}
              />

              {/* New Button to navigate to PaymentMethodsScreen */}
              <TouchableOpacity
                style={styles.paymentMethodsButton}
                onPress={() => navigation.navigate("PaymentMethodsScreen")}
              >
                <Ionicons name="card" size={24} color="#FF6F00" />
                <Text style={styles.paymentMethodsButtonText}>Gérer les moyens de paiement</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
          
          {/* Payment Method Modal */}
          <Modal
            visible={paymentModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setPaymentModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choisissez votre méthode de paiement</Text>
                  <TouchableOpacity
                    onPress={() => setPaymentModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color="#FF6F00" />
                  </TouchableOpacity>
                </View>

                <View style={styles.paymentMethodsList}>
                  {/* Cash option is always available */}
                  {renderPaymentMethod(
                    { id: "cash", type: "cash", title: "Cash" },
                    "cash"
                  )}
                  
                  {/* User's saved payment methods (excluding any duplicate "cash" method) */}
                  {paymentMethods && paymentMethods.length > 0 && paymentMethods
                    .filter(method => method.type !== "cash")
                    .map((method, index) => renderPaymentMethod(method, index))}
                  
                  {/* Add payment method button */}
                  <TouchableOpacity
                    style={styles.addPaymentButton}
                    onPress={() => {
                      setPaymentModalVisible(false);
                      navigation.navigate("PaymentMethodsScreen");
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={24} color="#FF6F00" />
                    <Text style={styles.addPaymentText}>Ajouter un moyen de paiement</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={completeRideRequest}
                >
                  <Text style={styles.confirmButtonText}>Confirmer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
};

/** 
 * RideOption Component with Hold-to-Confirm and Charging Animation 
 */
const RideOption = ({
  rideType,
  iconName,
  arrivalTime,
  distance,
  fare,
  onSelect,
  useMotoImage,
  maxPeople,
}) => {
  const [pressing, setPressing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const startPress = () => {
    setPressing(true);
    // Animate progress from 0 to 1 over 1 second
    Animated.timing(progress, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
    timerRef.current = setTimeout(() => {
      onSelect();
      resetPress();
    }, 1000);
  };

  const resetPress = () => {
    clearTimeout(timerRef.current);
    Animated.timing(progress, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start();
    setPressing(false);
  };

  const onPressOut = () => {
    if (pressing) {
      resetPress();
    }
  };

  return (
    <TouchableOpacity
      style={styles.rideOption}
      onPressIn={startPress}
      onPressOut={onPressOut}
    >
      {useMotoImage ? (
        <Image source={CavalMotoIcon} style={styles.motoIcon} resizeMode="contain" />
      ) : (
        <Ionicons name={iconName} size={32} color="#FF6F00" style={styles.icon} />
      )}
      <View style={styles.infoContainer}>
        <Text style={styles.rideTitle}>{rideType}</Text>
        <Text style={styles.rideSubtitle}>
          Arrivée vers {arrivalTime} • {distance} km
        </Text>
        {maxPeople && (
          <View style={styles.maxPeopleContainer}>
            <Ionicons name="people-outline" size={14} color="#FF6F00" />
            <Text style={styles.maxPeopleText}>Maximum {maxPeople} passagers</Text>
          </View>
        )}
        <View style={styles.longPressHint}>
          <Ionicons name="finger-print" size={14} color="#FF6F00" />
          <Text style={styles.longPressText}>Appuyez longuement pour sélectionner</Text>
        </View>
      </View>
      <Text style={styles.price}>{Math.round(fare)} Fdj</Text>
      {pressing && (
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default RideOptionsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  backButtonContainer: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 100,
    backgroundColor: "#1E1E1E",
    borderRadius: 25,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  recenterButtonContainer: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 100,
    backgroundColor: "#1E1E1E",
    borderRadius: 25,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,30,30,0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pin: {
    width: 25,
    height: 25,
    marginRight: 6,
  },
  markerLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    maxWidth: 100,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingVertical: 25,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 15,
    textAlign: "center",
  },
  rideOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 15,
    paddingVertical: 18,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  icon: {
    marginRight: 16,
  },
  motoIcon: {
    width: 36,
    height: 36,
    marginRight: 16,
    tintColor: "#FF6F00",
  },
  infoContainer: {
    flex: 1,
  },
  rideTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 3,
  },
  rideSubtitle: {
    fontSize: 14,
    color: "#b3b3b3",
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF6F00",
    marginLeft: 10,
  },
  progressContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#333",
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#FF6F00",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingVertical: 30,
    paddingHorizontal: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingRight: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginRight: 20,
  },
  closeButton: {
    padding: 5,
    marginLeft: 5,
  },
  paymentMethodsList: {
    marginBottom: 20,
  },
  paymentMethodItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  selectedPaymentMethod: {
    borderColor: "#FF6F00",
    borderWidth: 2,
  },
  paymentMethodInfo: {
    flex: 1,
    marginLeft: 15,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 15,
  },
  paymentMethodSubtitle: {
    fontSize: 14,
    color: '#b3b3b3',
  },
  addPaymentButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 15,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#FF6F00",
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginTop: 5,
  },
  addPaymentText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FF6F00",
    marginLeft: 10,
  },
  confirmButton: {
    backgroundColor: "#FF6F00",
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  // New Payment Methods Button Styles
  paymentMethodsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#FF6F00",
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  paymentMethodsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF6F00",
    marginLeft: 8,
  },
  maxPeopleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(255, 111, 0, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  maxPeopleText: {
    fontSize: 12,
    color: '#FF6F00',
    marginLeft: 4,
    fontWeight: '500',
  },
  routeSummaryContainer: {
    backgroundColor: '#2C2C2C',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6F00',
    marginRight: 12,
  },
  routeDotDestination: {
    backgroundColor: '#4CAF50',
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    marginRight: 8,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#666',
    marginLeft: 5,
    marginVertical: 5,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 15,
  },
  longPressHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255, 111, 0, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  longPressText: {
    fontSize: 12,
    color: '#FF6F00',
    marginLeft: 4,
    fontWeight: '500',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  editButton: {
    padding: 5,
  },
  autocompleteContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelEditButton: {
    padding: 5,
    marginLeft: 8,
  },
  locationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editLocationButton: {
    padding: 5,
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 100,
    backgroundColor: "#1E1E1E",
    borderRadius: 25,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  locationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinDropButton: {
    padding: 5,
  },
  selectionBottomSheet: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  selectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 5,
    padding: 15,
  },
  selectionSubtitle: {
    fontSize: 14,
    color: "#fff",
    padding: 15,
  },
  selectionSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  selectionSearchText: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
  },
  selectionConfirmButton: {
    backgroundColor: "#FF6F00",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  selectionConfirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  selectionCancelButton: {
    padding: 15,
    alignItems: "center",
  },
  selectionCancelButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  fullScreenBackButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 100,
    backgroundColor: "#1E1E1E",
    borderRadius: 25,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fullScreenSelectionBottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
    zIndex: 1000,
    elevation: 1000,
  },
  customTextInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#2D2D2D",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#FF6F00",
  },
  customDropdown: {
    position: "absolute",
    top: 45,
    left: 0,
    right: 0,
    backgroundColor: "#2D2D2D",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF6F00",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 99999,
    maxHeight: 150,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#fff",
  },
});