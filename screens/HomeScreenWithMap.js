import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  Linking,
  Animated,
} from "react-native";
import * as Location from "expo-location";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { auth, firestore } from "../firebase.config";
import CavalLogo from "../assets/Caval_Logo-removebg-preview.png";
import CustomPin from "../assets/CustomPin.png";
import { useNavigation, useRoute } from "@react-navigation/native";
import MapViewDirections from 'react-native-maps-directions';

const RECENT_SEARCHES_KEY = "recentSearches";
const THEME_STORAGE_KEY = "appTheme";
const { width, height } = Dimensions.get("window");

// Use the new API key directly
const GOOGLE_API_KEY = 'AIzaSyBnVN-ACYzcA0Sy8BcPLpXG50Y9T8jhJGE';

const HomeScreenWithMap = ({ userName = "User" }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [listViewDisplayed, setListViewDisplayed] = useState(false);

  // Theme state – retained for other UI elements, but the map will use dark theme always.
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Set up keyboard listeners to update keyboardHeight
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

  const defaultZoomDelta = {
    latitudeDelta: 0.0322,
    longitudeDelta: 0.0321,
  };

  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    ...defaultZoomDelta,
  });

  const [fromLocation, setFromLocation] = useState(null);
  const [pickupText, setPickupText] = useState("");
  const [showPickupInput, setShowPickupInput] = useState(false);
  const [pickupInputVisible, setPickupInputVisible] = useState(false);
  const [destination, setDestination] = useState(null);

  // Customer info
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerPhoto, setCustomerPhoto] = useState(null);
  const [customerPhone, setCustomerPhone] = useState(null);
  const [customerTariff, setCustomerTariff] = useState(null);

  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchText, setSearchText] = useState("");

  const googlePlacesRef = useRef(null);
  const googlePickupRef = useRef(null);
  const mapRef = useRef(null);

  const zoomedInDelta = {
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  // Map Styles – use dark style always for the map.
  const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#aaaaaa" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6e6e6e" }] },
  ];

  // Load & save theme preferences.
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === "dark");
        }
      } catch (error) {
        console.error("Error loading theme preference:", error);
      }
    };
    loadThemePreference();
  }, []);

  useEffect(() => {
    const saveThemePreference = async () => {
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    };
    saveThemePreference();
  }, [isDarkMode]);

  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const storedSearches = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (storedSearches !== null) {
          setRecentSearches(JSON.parse(storedSearches));
        }
      } catch (error) {
        console.error("Erreur lors du chargement des recherches récentes :", error);
      }
    };
    loadRecentSearches();
  }, []);

  useEffect(() => {
    const saveRecentSearches = async () => {
      try {
        await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
      } catch (error) {
        console.error("Erreur lors de l'enregistrement des recherches récentes :", error);
      }
    };
    saveRecentSearches();
  }, [recentSearches]);

  useEffect(() => {
    (async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const docRef = doc(firestore, "Customers", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setCustomerFirstName(userData.firstName || userName || "User");
            setCustomerPhoto(userData.photo || null);
            setCustomerPhone(userData.number || null);
            setCustomerTariff(userData.tariff || 9.99);
          } else {
            console.log("No document found in Firestore!");
            setCustomerFirstName(userName || "User");
          }
        } catch (error) {
          console.error("Error fetching customer data:", error);
          setCustomerFirstName(userName || "User");
        }
      } else {
        console.log("User not logged in");
        setCustomerFirstName(userName || "User");
      }
    })();
  }, [userName]);

  // Update customerFirstName when userName prop changes (backup mechanism)
  useEffect(() => {
    if (userName && userName !== "User") {
      setCustomerFirstName(userName);
    }
  }, [userName]);

  // Add a listener for when the screen comes into focus to refresh user data
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Refresh user data when screen comes into focus
      (async () => {
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const docRef = doc(firestore, "Customers", currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const userData = docSnap.data();
              setCustomerFirstName(userData.firstName || userName || "User");
              setCustomerPhoto(userData.photo || null);
              setCustomerPhone(userData.number || null);
              setCustomerTariff(userData.tariff || 9.99);
            }
          } catch (error) {
            console.error("Error refreshing customer data:", error);
          }
        }
      })();
    });

    return unsubscribe;
  }, [navigation, userName]);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Localisation désactivée",
            "Veuillez activer les services de localisation pour utiliser l'application.",
            [
              {
                text: "Annuler",
                style: "cancel"
              },
              {
                text: "Paramètres",
                onPress: () => Linking.openSettings()
              }
            ]
          );
          return;
        }

        // Check if location services are enabled
        const locationEnabled = await Location.hasServicesEnabledAsync();
        if (!locationEnabled) {
          Alert.alert(
            "Services de localisation désactivés",
            "Veuillez activer les services de localisation dans les paramètres de votre appareil.",
            [
              {
                text: "Annuler",
                style: "cancel"
              },
              {
                text: "Paramètres",
                onPress: () => Linking.openSettings()
              }
            ]
          );
          return;
        }

        setLoading(true);
        const currentPosition = await Location.getCurrentPositionAsync({});
        setLoading(false);
        if (currentPosition && currentPosition.coords) {
          const { latitude, longitude } = currentPosition.coords;
          if (!pickupText) {
            setFromLocation({ latitude, longitude });
            setPickupText("Position actuelle");
          }
          // Shift the view down by adjusting the latitude
          const adjustedLatitude = latitude - 0.005; // Reduced shift to 0.005 degrees
          setRegion({ latitude: adjustedLatitude, longitude, ...defaultZoomDelta });
          mapRef.current?.animateToRegion({ latitude: adjustedLatitude, longitude, ...defaultZoomDelta }, 1000);
        }
      } catch (err) {
        setLoading(false);
        Alert.alert(
          "Erreur de localisation",
          "Impossible d'obtenir votre position actuelle. Veuillez vérifier que les services de localisation sont activés.",
          [
            {
              text: "Annuler",
              style: "cancel"
            },
            {
              text: "Paramètres",
              onPress: () => Linking.openSettings()
            }
          ]
        );
        console.error("Erreur lors de l'obtention de la localisation :", err);
      }
    })();
  }, []);

  const handlePickupSelect = async (data, details = null) => {
    try {
      if (!details) {
        console.error("Détails non trouvés pour le lieu de départ sélectionné");
        return;
      }
      const location = details.geometry.location;
      setFromLocation({ latitude: location.lat, longitude: location.lng });
      setPickupText(data.description);
      setPickupInputVisible(true);
      mapRef.current?.animateToRegion({ latitude: location.lat, longitude: location.lng, ...zoomedInDelta }, 500);
      setTimeout(() => setShowPickupInput(false), 500);
    } catch (error) {
      console.error("Erreur lors de la sélection du lieu de départ :", error);
    }
  };

  const requestRide = async (origin, destination) => {
    try {
      const rideRequestData = {
        customerName: customerFirstName,
        customerPhone: customerPhone,
        customerPhoto: customerPhoto,
        origin,
        destination,
        createdAt: new Date(),
        activity: "active",
        userId: auth.currentUser?.uid || null,
      };
      await addDoc(collection(firestore, "rideRequests"), rideRequestData);
      console.log("Ride request successfully sent.");
    } catch (error) {
      console.error("Error sending ride request:", error);
    }
  };

  const handleDestinationSelect = async (data, details = null) => {
    try {
      if (!details) {
        console.error("Détails non trouvés pour la destination sélectionnée");
        return;
      }
      if (!fromLocation) {
        console.error("La position de départ n'est pas définie");
        return;
      }
      setLoading(true);
      const location = details.geometry.location;
      const destinationCoords = { latitude: location.lat, longitude: location.lng };
      
      // Set the destination state for the map
      setDestination(destinationCoords);
      
      // Safely update recentSearches
      setRecentSearches((prev) => {
        const prevSearches = Array.isArray(prev) ? prev : [];
        const newList = [data.description, ...prevSearches.filter((s) => s !== data.description)];
        return newList.slice(0, 3);
      });

      const originData = { latitude: fromLocation.latitude, longitude: fromLocation.longitude, address: pickupText };
      const destinationData = { latitude: destinationCoords.latitude, longitude: destinationCoords.longitude, address: data.description };
      await requestRide(originData, destinationData);
      setLoading(false);
      navigation.navigate("RideOptionsScreen", {
        origin: originData,
        destination: destinationData,
        customerFirstName,
        customerPhoto,
        customerPhone,
      });
    } catch (error) {
      setLoading(false);
      console.error("Erreur lors de la sélection de la destination :", error);
    }
  };

  const handleGoPress = async () => {
    if (!searchText.trim()) return;
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          searchText
        )}&key=${GOOGLE_API_KEY}`,
        {
          signal: controller.signal,
          timeout: 10000 // 10 second timeout
        }
      );
      clearTimeout(timeoutId);
      const data = await response.json();
      if (data.status === "OK" && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const destinationCoords = { latitude: location.lat, longitude: location.lng };
        
        // Set the destination state for the map
        setDestination(destinationCoords);
        
        // Safely update recentSearches
        setRecentSearches((prev) => {
          const prevSearches = Array.isArray(prev) ? prev : [];
          const newList = [searchText, ...prevSearches.filter((s) => s !== searchText)];
          return newList.slice(0, 3);
        });

        const originData = { latitude: fromLocation.latitude, longitude: fromLocation.longitude, address: pickupText };
        const destinationData = { latitude: destinationCoords.latitude, longitude: destinationCoords.longitude, address: searchText };
        await requestRide(originData, destinationData);
        setLoading(false);
        navigation.navigate("RideOptionsScreen", { origin: originData, destination: destinationData });
      } else {
        setLoading(false);
        alert("Impossible de trouver la localisation. Veuillez essayer une autre destination.");
      }
    } catch (error) {
      setLoading(false);
      if (error.name === 'AbortError') {
        console.error("Request timed out");
        alert("La requête a expiré. Veuillez réessayer.");
      } else {
        console.error("Erreur lors de la récupération de la géolocalisation :", error);
        alert("Erreur lors de la récupération de la localisation. Veuillez réessayer.");
      }
    }
  };

  const handleRecentSearchPress = (searchString) => {
    if (googlePlacesRef.current) {
      googlePlacesRef.current.setAddressText(searchString);
      setSearchText(searchString);
    }
  };

  const centerOnCurrentLocation = () => {
    if (fromLocation) {
      // Shift the view down by adjusting the latitude
      const adjustedLatitude = fromLocation.latitude - 0.005; // Reduced shift to 0.005 degrees
      mapRef.current?.animateToRegion(
        { latitude: adjustedLatitude, longitude: fromLocation.longitude, ...defaultZoomDelta },
        500
      );
    }
  };

  // Theme toggle function
  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  // Add new state for map selection mode
  const [selectionMode, setSelectionMode] = useState(null); // 'pickup' or 'dropoff' or null
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Add animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const mapScaleAnim = useRef(new Animated.Value(1)).current;

  // Add animation function
  const animateTransition = (toSelectionMode) => {
    if (toSelectionMode) {
      // Animate to full screen
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(mapScaleAnim, {
          toValue: 1.1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate back to normal view
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(mapScaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // Modify startLocationSelection to include animation
  const startLocationSelection = (mode) => {
    animateTransition(true);
    setSelectionMode(mode);
    setSelectedLocation(null);
  };

  // Modify the selection mode cancel to include animation
  const handleCancelSelection = () => {
    animateTransition(false);
    setTimeout(() => {
      setSelectionMode(null);
    }, 300);
  };

  // Add debounce function at the top with other imports
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Add new state for tracking the center point
  const [mapCenter, setMapCenter] = useState(null);

  // Update the handleRegionChange function
  const handleRegionChange = debounce(async (newRegion) => {
    if (selectionMode) {
      // Only update the center point, not the entire region
      setMapCenter({
        latitude: newRegion.latitude,
        longitude: newRegion.longitude
      });
    }
  }, 100);

  // Add new function to handle region change complete
  const handleRegionChangeComplete = async (newRegion) => {
    if (selectionMode) {
      setRegion(newRegion);
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

  // Update handleMapPress function
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
          setFromLocation(coordinate);
          setPickupText(address);
          setPickupInputVisible(true);
          setShowPickupInput(false);
        } else if (selectionMode === 'dropoff') {
          const destinationCoords = {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: address
          };
          
          // Set the destination state for the map
          setDestination(destinationCoords);
          
          const originData = {
            latitude: fromLocation.latitude,
            longitude: fromLocation.longitude,
            address: pickupText
          };
          
          // Create the ride request data
          const rideRequestData = {
            customerName: customerFirstName,
            customerPhone: customerPhone,
            customerPhoto: customerPhoto,
            origin: originData,
            destination: destinationCoords,
            createdAt: new Date(),
            activity: "active",
            userId: auth.currentUser?.uid || null,
          };
          
          // Save to Firestore
          await addDoc(collection(firestore, "rideRequests"), rideRequestData);
          
          // Navigate to RideOptionsScreen with proper coordinates
          navigation.navigate("RideOptionsScreen", {
            origin: originData,
            destination: destinationCoords,
            customerFirstName,
            customerPhoto,
            customerPhone,
            distance: calculateDistance(originData, destinationCoords),
          });
        }
        
        setSelectionMode(null);
        mapRef.current?.animateToRegion({ ...coordinate, ...zoomedInDelta }, 500);
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

  // Add distance calculation function
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

    return distance.toFixed(1); // Return distance in kilometers with 1 decimal place
  };

  // Generate styles (keyboardHeight is used to compute autocomplete list maxHeight)
  const getThemedStyles = () => {
    return StyleSheet.create({
      container: { flex: 1, backgroundColor: isDarkMode ? "#121212" : "#fff" },
      mapContainer: { ...StyleSheet.absoluteFillObject },
      map: { ...StyleSheet.absoluteFillObject },
      topBar: {
        position: "absolute",
        top: Platform.OS === "ios" ? 50 : 40,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        zIndex: 10,
      },
      logo: { width: 100, height: 40, resizeMode: "contain" },
      currentLocationButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#fff",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      },
      themeToggleButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#fff",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
        marginRight: 10,
      },
      activeRideBanner: {
        position: "absolute",
        top: Platform.OS === "ios" ? 100 : 90,
        left: 16,
        right: 16,
        borderRadius: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 5,
        zIndex: 5,
      },
      activeRideBannerGradient: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
      activeRideBannerText: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
      bottomContainer: {
        padding: Platform.OS === "ios" ? 20 : 16,
        paddingTop: 10,
        paddingBottom: Platform.OS === "ios" ? 100 : 16,
        backgroundColor: isDarkMode ? "#1E1E1E" : "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: -4 },
        shadowRadius: 12,
        elevation: 8,
        maxHeight: Platform.OS === 'android' ? '60%' : '50%',
        zIndex: 5,
        position: 'absolute',
        bottom: keyboardVisible ? (Platform.OS === 'ios' ? 1 : keyboardHeight + 10) : Platform.OS === 'android' ? 80 : 0,
        left: 0,
        right: 0,
      },
      bottomContainerHeader: { alignItems: "center", marginBottom: 12 },
      dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: isDarkMode ? "#3D3D3D" : "#D1D5DB",
        borderRadius: 2,
        marginVertical: 8,
      },
      rowContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
      greetingText: {
        fontSize: 22,
        fontWeight: "600",
        color: isDarkMode ? "#E0E0E0" : "#1F2937",
        flex: 1,
      },
      searchContainer: { backgroundColor: "transparent" },
      searchInput: {
        height: 50,
        borderRadius: 10,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F3F4F6",
        paddingHorizontal: 16,
        fontSize: 16,
        color: isDarkMode ? "#fff" : "#333",
        borderWidth: 1,
        borderColor: isDarkMode ? "#444" : "#ddd",
      },
      // Autocomplete list view with fixed positioning to ensure it's always visible
      autocompleteListView: {
        backgroundColor: isDarkMode ? "#2D2D2D" : "#fff",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#FF6F00",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        marginTop: 4,
        maxHeight: Platform.OS === 'android' ? 200 : 250,
        zIndex: 9999,
        position: 'absolute',
        top: Platform.OS === 'android' ? 45 : 52,
        left: 0,
        right: 0,
      },
      // Custom row rendering: two lines with black font.
      customAutocompleteRow: {
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
      },
      customAutocompleteMainText: {
        fontSize: 20,
        color: "#000", // force black font
        fontWeight: "600",
      },
      customAutocompleteSecondaryText: {
        fontSize: 16,
        color: "#000", // force black font
        marginTop: 6,
      },
      smallButton: {
        backgroundColor: "#FF6F00",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        shadowColor: "#FF6F00",
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
      },
      smallButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
      cancelButton: {
        marginLeft: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F3F4F6",
        borderWidth: 1,
        borderColor: isDarkMode ? "#3D3D3D" : "#E5E7EB",
      },
      cancelButtonText: { color: isDarkMode ? "#B0B0B0" : "#4B5563", fontSize: 14, fontWeight: "600" },
      selectedAddressContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F3F4F6",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 16,
      },
      selectedAddressText: { marginLeft: 8, fontSize: 14, color: isDarkMode ? "#B0B0B0" : "#4B5563" },
      destinationRowContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: Platform.OS === 'android' ? 8 : 16,
        position: "relative",
        zIndex: 999,
        paddingTop: Platform.OS === 'android' ? 5 : 0,
      },
      destinationIconContainer: { position: "absolute", left: 14, top: 14, zIndex: 1001 },
      destinationSearchContainer: { 
        flex: 1, 
        backgroundColor: "transparent", 
        zIndex: 1000,
        position: 'relative',
        marginBottom: Platform.OS === 'android' ? 10 : 0,
      },
      destinationSearchInput: {
        height: Platform.OS === 'android' ? 45 : 50,
        borderRadius: 10,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F3F4F6",
        paddingLeft: 42,
        paddingRight: 16,
        fontSize: 16,
        color: isDarkMode ? "#fff" : "#333",
        borderWidth: 1,
        borderColor: isDarkMode ? "#444" : "#ddd",
        zIndex: 1000,
      },
      goButton: {
        marginLeft: 12,
        borderRadius: 10,
        overflow: "hidden",
        shadowColor: "#FF6F00",
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
        zIndex: 1001,
      },
      goButtonGradient: { paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
      goButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
      recentSearchesContainer: {
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F9FAFB",
        padding: Platform.OS === "ios" ? 16 : 16,
        borderRadius: 16,
        marginBottom: Platform.OS === "ios" ? 16 : 16,
        marginTop: Platform.OS === "ios" ? 20 : 0,
      },
      recentSearchesTitle: { 
        fontSize: 16, 
        fontWeight: "600", 
        marginBottom: Platform.OS === "ios" ? 8 : 12, 
        color: isDarkMode ? "#E0E0E0" : "#1F2937" 
      },
      recentSearchItem: { 
        flexDirection: "row", 
        alignItems: "center", 
        marginBottom: Platform.OS === "ios" ? 12 : 16 
      },
      recentSearchText: { fontSize: 14, color: isDarkMode ? "#B0B0B0" : "#4B5563", flex: 1 },
      loadingContainer: { flexDirection: "row", alignItems: "center", marginTop: 20 },
      loadingText: { marginLeft: 12, fontSize: 16, color: isDarkMode ? "#E0E0E0" : "#374151" },
      placeItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
      placeName: { marginLeft: 8, fontSize: 16, color: isDarkMode ? "#E0E0E0" : "#1F2937" },
      mapSelectionOverlay: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 80,
        left: 16,
        right: 16,
        backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 5,
        zIndex: 10,
      },
      mapSelectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
      },
      mapSelectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: isDarkMode ? '#fff' : '#1F2937',
        marginLeft: 8,
      },
      mapSelectionText: {
        fontSize: 13,
        color: isDarkMode ? '#B0B0B0' : '#4B5563',
        lineHeight: 18,
      },
      mapSelectionButton: {
        backgroundColor: '#FF6F00',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 8,
        alignItems: 'center',
      },
      mapSelectionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
      },
      dropPinInstruction: {
        position: 'absolute',
        bottom: 40,
        left: 16,
        right: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      },
      dropPinInstructionContent: {
        backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 5,
      },
      dropPinInstructionText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: isDarkMode ? '#fff' : '#1F2937',
      },
      selectionBottomSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -20,
        backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: -4 },
        shadowRadius: 12,
        elevation: 8,
        zIndex: 30,
        alignItems: 'center',
        marginBottom: Platform.OS === 'ios' ? 40 : 20,
        paddingBottom: Platform.OS === 'ios' ? 100 : 60,
        transform: [{ translateY: Platform.OS === 'ios' ? 0 : 0 }],
      },
      selectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: isDarkMode ? '#fff' : '#111',
        marginBottom: 4,
      },
      selectionSubtitle: {
        fontSize: 15,
        color: isDarkMode ? '#B0B0B0' : '#666',
        marginBottom: 18,
      },
      selectionSearchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDarkMode ? '#2D2D2D' : '#F3F4F6',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 8,
        marginBottom: 18,
        width: '100%',
        borderWidth: 1,
        borderColor: isDarkMode ? '#444' : '#ddd',
      },
      selectionSearchText: {
        flex: 1,
        fontSize: 16,
        color: isDarkMode ? '#fff' : '#222',
        marginLeft: 8,
      },
      selectionConfirmButton: {
        backgroundColor: '#FF6F00',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
        shadowColor: '#FF6F00',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
      },
      selectionConfirmButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
      },
      selectionCancelButton: {
        alignItems: 'center',
        paddingVertical: 8,
        width: '100%',
      },
      backButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 40,
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: isDarkMode ? '#2D2D2D' : '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
        zIndex: 20,
      },
    });
  };

  const styles = getThemedStyles();

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <View style={styles.container}>
          {/* MAP */}
          <View style={styles.mapContainer}>
            <Animated.View style={[
              StyleSheet.absoluteFill,
              {
                transform: [
                  { scale: mapScaleAnim }
                ]
              }
            ]}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_DEFAULT}
                style={StyleSheet.absoluteFill}
                region={region}
                customMapStyle={darkMapStyle}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                rotateEnabled={false}
                mapPadding={{ 
                  top: 100, 
                  right: 0, 
                  bottom: selectionMode ? 0 : Platform.OS === 'ios' ? 350 : 100, 
                  left: 0 
                }}
                onPress={handleMapPress}
                onRegionChange={handleRegionChange}
                onRegionChangeComplete={handleRegionChangeComplete}
                moveOnMarkerPress={false}
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={false}
                minZoomLevel={5}
                maxZoomLevel={20}
              >
                {/* Always show the pickup marker unless we're selecting a new pickup */}
                {(fromLocation && (selectionMode !== 'pickup')) && (
                  <Marker coordinate={fromLocation} title="Votre position" anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={{
                      width: 32,
                      height: 32,
                      backgroundColor: '#FF6F00',
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: '#fff',
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 5,
                    }}>
                      <Ionicons name="location" size={16} color="#fff" />
                    </View>
                  </Marker>
                )}
                {/* Show destination marker when destination is selected */}
                {destination && (
                  <Marker coordinate={destination} title="Destination" anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={{
                      width: 32,
                      height: 32,
                      backgroundColor: '#4CAF50',
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: '#fff',
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 5,
                    }}>
                      <Ionicons name="flag" size={16} color="#fff" />
                    </View>
                  </Marker>
                )}
                {/* Draw the route and center it in the visible area */}
                {(fromLocation && destination && !selectionMode) && (
                  <MapViewDirections
                    origin={fromLocation}
                    destination={destination}
                    apikey={GOOGLE_API_KEY}
                    strokeWidth={4}
                    strokeColor="#FF6F00"
                    onReady={result => {
                      mapRef.current?.fitToCoordinates(result.coordinates, {
                        edgePadding: {
                          top: 60, // Height of the gap at the top
                          right: 40,
                          bottom: Platform.OS === 'ios' ? 350 : 320, // Height of the bottom card
                          left: 40,
                        },
                        animated: true,
                      });
                    }}
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
            </Animated.View>

            {/* Back button in selection mode */}
            {selectionMode && (
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={handleCancelSelection}
              >
                <Ionicons 
                  name="arrow-back" 
                  size={24} 
                  color={isDarkMode ? "#fff" : "#000"} 
                />
              </TouchableOpacity>
            )}

            {/* Map selection overlay */}
            {!selectionMode && (
              <Animated.View style={[
                styles.mapSelectionOverlay,
                {
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -20]
                    })}
                  ]
                }
              ]}>
                <View style={styles.mapSelectionHeader}>
                  <Ionicons name="map-outline" size={20} color="#FF6F00" />
                  <Text style={styles.mapSelectionTitle}>Sélection sur la carte</Text>
                </View>
                <Text style={styles.mapSelectionText}>
                  Appuyez sur les boutons ci-dessous pour sélectionner votre trajet sur la carte.
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <TouchableOpacity 
                    style={[styles.mapSelectionButton, { flex: 1, marginRight: 8 }]} 
                    onPress={() => startLocationSelection('pickup')}
                  >
                    <Text style={styles.mapSelectionButtonText}>Départ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.mapSelectionButton, { flex: 1, marginLeft: 8 }]} 
                    onPress={() => startLocationSelection('dropoff')}
                  >
                    <Text style={styles.mapSelectionButtonText}>Arrivée</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* Selection mode bottom sheet */}
            {selectionMode && (
              <View style={styles.selectionBottomSheet}>
                <Text style={styles.selectionTitle}>Définissez votre destination</Text>
                <Text style={styles.selectionSubtitle}>Faites glisser la carte pour déplacer l'épingle</Text>
                <View style={styles.selectionSearchBar}>
                  <Ionicons name="location-outline" size={20} color="#FF6F00" style={{ marginLeft: 8 }} />
                  <Text style={styles.selectionSearchText}>{searchText || 'Rechercher un lieu'}</Text>
                  <TouchableOpacity style={{ marginRight: 8 }}>
                    <Ionicons name="search" size={20} color="#FF6F00" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.selectionConfirmButton} onPress={() => handleMapPress({ nativeEvent: { coordinate: region } })}>
                  <Text style={styles.selectionConfirmButtonText}>Confirmer la destination</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.selectionCancelButton} onPress={handleCancelSelection}>
                  <Text style={styles.selectionCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* TOP BAR WITH THEME TOGGLE */}
          {!selectionMode && (
            <Animated.View style={[
              styles.topBar,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20]
                  })}
                ]
              }
            ]}>
              <Image source={CavalLogo} style={styles.logo} />
              <View style={{ flexDirection: "row" }}>
                <TouchableOpacity style={styles.themeToggleButton} onPress={toggleTheme}>
                  <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color={isDarkMode ? "#FFD700" : "#6B7280"} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.currentLocationButton} onPress={centerOnCurrentLocation}>
                  <Ionicons name="locate" size={24} color="#FF6F00" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* ACTIVE RIDE BANNER */}
          {!selectionMode && route.params?.activeRide && (
            <TouchableOpacity style={styles.activeRideBanner} onPress={() => navigation.navigate("DriverFoundScreen", route.params.activeRide)}>
              <LinearGradient colors={["#FF9500", "#FF6F00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.activeRideBannerGradient}>
                <Ionicons name="car-sport" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.activeRideBannerText}>Vous avez une course en cours</Text>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* BOTTOM CONTAINER */}
          {!selectionMode && (
            <Animated.View style={[
              styles.bottomContainer,
              {
                position: 'absolute',
                bottom: keyboardVisible ? (Platform.OS === 'ios' ? 1 : keyboardHeight + 10) : Platform.OS === 'android' ? 80 : 0,
                left: 0,
                right: 0,
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 100]
                  })}
                ]
              }
            ]}>
              <View style={styles.bottomContainerHeader}>
                <View style={styles.dragHandle} />
              </View>
              
              {!showPickupInput ? (
                <View style={styles.rowContainer}>
                  <Text style={styles.greetingText}>
                    Bonjour, <Text style={{ fontWeight: "700" }}>{customerFirstName}</Text> !
                  </Text>
                  <TouchableOpacity 
                    style={styles.smallButton} 
                    onPress={() => { setShowPickupInput(true); setPickupInputVisible(true); }}
                  >
                    <Text style={styles.smallButtonText}>Modifier lieu de départ</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.greetingText}>
                    Bonjour, <Text style={{ fontWeight: "700" }}>{customerFirstName}</Text> !
                  </Text>
                  <View style={styles.rowContainer}>
                    <GooglePlacesAutocomplete
                      ref={googlePickupRef}
                      placeholder="Lieu de départ"
                      fetchDetails
                      onPress={handlePickupSelect}
                      query={{
                        key: GOOGLE_API_KEY,
                        language: "fr",
                        components: "country:DJ",
                      }}
                      debounce={400}
                      listViewDisplayed="auto"
                      keyboardShouldPersistTaps="always"
                      textInputProps={{
                        value: pickupText,
                        onChangeText: (text) => setPickupText(text),
                        placeholderTextColor: isDarkMode ? "#6B7280" : "#9CA3AF",
                      }}
                      renderRow={(data) => (
                        <View style={styles.customAutocompleteRow}>
                          <Text style={styles.customAutocompleteMainText}>
                            {data.structured_formatting?.main_text || data.description}
                          </Text>
                          {data.structured_formatting?.secondary_text && (
                            <Text style={styles.customAutocompleteSecondaryText}>
                              {data.structured_formatting.secondary_text}
                            </Text>
                          )}
                        </View>
                      )}
                      predefinedPlaces={[]}
                      ListViewProps={{ 
                        showsVerticalScrollIndicator: true,
                        scrollEnabled: true,
                        nestedScrollEnabled: true,
                        keyboardShouldPersistTaps: "handled"
                      }}
                      styles={{
                        container: {
                          flex: 1,
                          backgroundColor: 'transparent',
                        },
                        textInput: {
                          height: 50,
                          borderRadius: 10,
                          backgroundColor: isDarkMode ? "#2D2D2D" : "#F3F4F6",
                          paddingHorizontal: 16,
                          fontSize: 16,
                          color: isDarkMode ? "#fff" : "#333",
                          borderWidth: 1,
                          borderColor: isDarkMode ? "#444" : "#ddd",
                        },
                        listView: {
                          backgroundColor: isDarkMode ? "#2D2D2D" : "#fff",
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: "#FF6F00",
                          elevation: 5,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.2,
                          shadowRadius: 8,
                          marginTop: 4,
                          maxHeight: 200,
                          zIndex: 9999,
                        }
                      }}
                      enablePoweredByContainer={false}
                      minLength={2}
                      timeout={10000}
                      onFail={(error) => {
                        console.log('GooglePlacesAutocomplete Error:', error);
                        setPickupText('');
                      }}
                      onNotFound={() => {
                        console.log('No results found');
                        setPickupText('');
                      }}
                      enableHighAccuracyLocation={true}
                      returnKeyType={'search'}
                      textInputHide={false}
                      nearbyPlacesAPI="GooglePlacesSearch"
                      GooglePlacesDetailsQuery={{
                        fields: "geometry,formatted_address"
                      }}
                      filterReverseGeocodingByTypes={['locality', 'administrative_area_level_3']}
                    />
                    <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowPickupInput(false); setPickupInputVisible(false); }}>
                      <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {pickupInputVisible && !showPickupInput && (
                <TouchableOpacity style={styles.selectedAddressContainer} onPress={() => setShowPickupInput(true)}>
                  <Ionicons name="location-sharp" size={18} color="#FF6F00" />
                  <Text style={styles.selectedAddressText}>{pickupText}</Text>
                </TouchableOpacity>
              )}

              <View style={styles.destinationRowContainer}>
                <View style={[styles.destinationIconContainer, Platform.OS === 'android' && { top: 12 }]}>
                  <Ionicons name="navigate-outline" size={20} color="#FF6F00" />
                </View>
                <View style={styles.destinationSearchContainer}>
                  <GooglePlacesAutocomplete
                    ref={googlePlacesRef}
                    placeholder="Où souhaitez-vous aller ?"
                    fetchDetails={true}
                    onPress={handleDestinationSelect}
                    query={{
                      key: GOOGLE_API_KEY,
                      language: "fr",
                      components: "country:DJ",
                    }}
                    debounce={400}
                    listViewDisplayed={true}
                    keyboardShouldPersistTaps="handled"
                    textInputProps={{
                      value: searchText,
                      onChangeText: setSearchText,
                      placeholderTextColor: isDarkMode ? "#6B7280" : "#9CA3AF",
                      onFocus: () => setIsSearchFocused(true),
                      onBlur: () => setIsSearchFocused(false),
                    }}
                    predefinedPlaces={[]}
                    ListViewProps={{ 
                      showsVerticalScrollIndicator: true,
                      scrollEnabled: true,
                      nestedScrollEnabled: true,
                      keyboardShouldPersistTaps: "handled",
                      style: styles.autocompleteListView,
                    }}
                    styles={{
                      container: styles.destinationSearchContainer,
                      textInput: styles.destinationSearchInput,
                      listView: styles.autocompleteListView,
                    }}
                    enablePoweredByContainer={false}
                    minLength={2}
                    timeout={10000}
                    onFail={(error) => {
                      console.log('GooglePlacesAutocomplete Error:', error);
                      setSearchText('');
                    }}
                    onNotFound={() => {
                      console.log('No results found');
                      setSearchText('');
                    }}
                    enableHighAccuracyLocation={true}
                    returnKeyType={'search'}
                    textInputHide={false}
                    nearbyPlacesAPI="GooglePlacesSearch"
                    GooglePlacesDetailsQuery={{
                      fields: "geometry,formatted_address"
                    }}
                    filterReverseGeocodingByTypes={['locality', 'administrative_area_level_3']}
                  />
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity style={styles.goButton} onPress={handleGoPress} disabled={loading || !searchText.trim()}>
                    <LinearGradient colors={["#FF9500", "#FF6F00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.goButtonGradient}>
                      <Text style={styles.goButtonText}>Go</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {recentSearches.length > 0 && (
                <View style={styles.recentSearchesContainer}>
                  <Text style={styles.recentSearchesTitle}>Recherches récentes</Text>
                  {recentSearches.map((search, index) => (
                    <TouchableOpacity key={index} style={styles.recentSearchItem} onPress={() => handleRecentSearchPress(search)}>
                      <Ionicons name="time-outline" size={18} color={isDarkMode ? "#6B7280" : "#9CA3AF"} style={{ marginRight: 8 }} />
                      <Text style={styles.recentSearchText}>{search}</Text>
                      <Ionicons name="arrow-forward" size={16} color={isDarkMode ? "#6B7280" : "#9CA3AF"} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FF6F00" />
                  <Text style={styles.loadingText}>Chargement...</Text>
                </View>
              )}

              {nearbyPlaces.length > 0 && (
                <FlatList
                  data={nearbyPlaces}
                  keyExtractor={(item, index) => `nearby-${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.placeItem}
                      onPress={() => {
                        if (googlePlacesRef.current) {
                          googlePlacesRef.current.setAddressText(item.name);
                          setSearchText(item.name);
                        }
                      }}
                    >
                      <Ionicons name="location-outline" size={20} color={isDarkMode ? "#6B7280" : "#9CA3AF"} />
                      <Text style={styles.placeName}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  style={{ marginTop: 10 }}
                  scrollEnabled={true}
                  maxHeight={150}
                />
              )}
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default HomeScreenWithMap;