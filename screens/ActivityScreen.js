import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  useColorScheme as _useColorScheme,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { firestore, auth } from "../firebase.config";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import ProfilePicture from '../components/ProfilePicture';
import * as Location from 'expo-location';
import { getAuth } from "firebase/auth";
import { MaterialIcons } from '@expo/vector-icons';

// Create Theme Context
const ThemeContext = React.createContext();

export const ThemeProvider = ({ children }) => {
  const deviceTheme = _useColorScheme();
  // Set default theme to dark
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Use the same API key as other screens
const GOOGLE_API_KEY = 'AIzaSyBnVN-ACYzcA0Sy8BcPLpXG50Y9T8jhJGE';

// Geocoding function
async function geocodeLatLng(lat, lng) {
  if (
    lat === undefined ||
    lng === undefined ||
    isNaN(Number(lat)) ||
    isNaN(Number(lng))
  ) {
    console.error("Invalid coordinates passed to geocodeLatLng:", lat, lng);
    return "Invalid coordinates";
  }
  const latitude = Number(lat);
  const longitude = Number(lng);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    
    // Fallback to Expo's Location.reverseGeocodeAsync
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
    
    console.error("Geocode API error:", data.status, data.error_message);
    return "Address not found";
  } catch (error) {
    console.error("Error reverse-geocoding:", error);
    return "Error fetching address";
  }
}

function ActivityScreen() {
  const navigation = useNavigation();
  const [currentRides, setCurrentRides] = useState([]);
  const [completedRides, setCompletedRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addressMap, setAddressMap] = useState({});
  const { theme, toggleTheme } = useTheme();

  // Get theme colors
  const colors = getThemeColors(theme);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Fetch current active rides
    const currentRidesRef = collection(firestore, "rideRequests");
    const currentQuery = query(
      currentRidesRef,
      where("userId", "==", currentUser.uid),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );

    // Fetch completed rides
    const completedQuery = query(
      currentRidesRef,
      where("userId", "==", currentUser.uid),
      where("status", "==", "completed"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribeCurrent = onSnapshot(currentQuery, (snapshot) => {
      const ridesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCurrentRides(ridesData);
    });

    const unsubscribeCompleted = onSnapshot(completedQuery, (snapshot) => {
      const ridesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCompletedRides(ridesData);
      setLoading(false);
    });

    return () => {
      unsubscribeCurrent();
      unsubscribeCompleted();
    };
  }, [auth]);

  // Fetch and store addresses for each ride
  useEffect(() => {
    (async () => {
      const allRides = [...currentRides, ...completedRides];
      for (const ride of allRides) {
        if (!addressMap[ride.id]) {
          let pickupAddress = "Address not found";
          let destinationAddress = "Address not found";
          if (ride.pickupLat && ride.pickupLng) {
            pickupAddress = await geocodeLatLng(ride.pickupLat, ride.pickupLng);
          }
          if (ride.destinationLat && ride.destinationLng) {
            destinationAddress = await geocodeLatLng(
              ride.destinationLat,
              ride.destinationLng
            );
          }
          setAddressMap((prev) => ({
            ...prev,
            [ride.id]: { pickupAddress, destinationAddress },
          }));
        }
      }
    })();
  }, [currentRides, completedRides]);

  // Helper to format the ride date/time
  function formatRideDate(rideDate) {
    if (!rideDate) return "Date inconnue";
    const now = new Date();
    const isToday =
      rideDate.getDate() === now.getDate() &&
      rideDate.getMonth() === now.getMonth() &&
      rideDate.getFullYear() === now.getFullYear();
    const timeStr = rideDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return isToday
      ? `Aujourd'hui à ${timeStr}`
      : `${rideDate.toLocaleDateString()} à ${timeStr}`;
  }

  const renderRideItem = ({ item, isCurrentRide = false }) => {
    // Convert Firestore timestamp to JavaScript Date object
    const formattedDate = item.createdAt && item.createdAt.toDate ? 
      formatRideDate(item.createdAt.toDate()) : 
      "Date inconnue";
      
    const pickupAddr =
      addressMap[item.id]?.pickupAddress ||
      `${item.pickupLat}, ${item.pickupLng}`;
    const destinationAddr =
      addressMap[item.id]?.destinationAddress ||
      `${item.destinationLat}, ${item.destinationLng}`;

    const handleRidePress = () => {
      if (isCurrentRide) {
        // Navigate to DriverFoundScreen for current rides
        navigation.navigate("DriverFoundScreen", {
          rideId: item.id,
          rideType: item.rideType,
          distance: typeof item.distance === "number" ? item.distance : 0,
          duration: typeof item.duration === "number" ? item.duration : 0,
          pickupLat: item.pickupLat,
          pickupLng: item.pickupLng,
          destinationLat: item.destinationLat,
          destinationLng: item.destinationLng,
          driverPhoto: item.driverPhoto,
          driverName: item.driverName,
          driverId: item.driverId,
          driverPhone: item.driverPhone,
          fare: item.fare || 0,
        });
      } else {
        // Show details alert for completed rides
        Alert.alert(
          "Détails de la course",
          `Course du ${formattedDate}\n\nDépart: ${pickupAddr}\nDestination: ${destinationAddr}\nDistance: ${typeof item.distance === "number" ? `${Number(item.distance).toFixed(1)} km` : "N/A"}\nDurée: ${typeof item.duration === "number" ? `${Number(item.duration).toFixed(0)} min` : "N/A"}\nPrix: ${item.fare ? `${item.fare} Fdj` : "N/A"}`,
          [{ text: "OK" }]
        );
      }
    };

    const getStatusText = () => {
      if (isCurrentRide) {
        switch (item.status) {
          case "active":
            return "En attente de chauffeur";
          case "assigned":
            return "Chauffeur assigné";
          case "pickup":
            return "En route vers vous";
          case "in_progress":
            return "Trajet en cours";
          default:
            return "En cours";
        }
      }
      return "Course terminée";
    };

    const getStatusColor = () => {
      if (isCurrentRide) {
        return colors.accent; // Orange for current rides
      }
      return colors.statusActive; // Green for completed rides
    };

    return (
      <TouchableOpacity
        style={[
          styles.card, 
          { 
            backgroundColor: colors.cardBackground,
            borderWidth: isCurrentRide ? 2 : 0,
            borderColor: isCurrentRide ? colors.accent : 'transparent',
            shadowOpacity: isCurrentRide ? 0.15 : 0.08,
            shadowRadius: isCurrentRide ? 12 : 8,
            elevation: isCurrentRide ? 6 : 3,
          }
        ]}
        activeOpacity={0.7}
        onPress={handleRidePress}
      >
        <View style={[
          styles.cardHeader, 
          { 
            backgroundColor: isCurrentRide ? colors.accent : colors.accentLight,
            paddingVertical: isCurrentRide ? 16 : 12,
          }
        ]}>
          <Text style={[
            styles.headerLeft, 
            { 
              color: isCurrentRide ? '#FFFFFF' : colors.textPrimary,
              fontSize: isCurrentRide ? 16 : 15,
              fontWeight: isCurrentRide ? "700" : "600",
            }
          ]}>
            {isCurrentRide ? (item.rideType || "Caval Taxi") : formattedDate}
          </Text>
          <View style={[
            styles.rideTypeContainer,
            { backgroundColor: isCurrentRide ? 'rgba(255,255,255,0.2)' : 'transparent' }
          ]}>
            <Text style={[
              styles.headerRight, 
              { 
                color: isCurrentRide ? '#FFFFFF' : colors.accent,
                fontSize: isCurrentRide ? 15 : 14,
                fontWeight: isCurrentRide ? "700" : "700",
              }
            ]}>
              {isCurrentRide ? "" : (item.rideType || "Caval Taxi")}
            </Text>
          </View>
          {isCurrentRide && (
            <View style={styles.currentRideBadge}>
              <Ionicons name="flash" size={16} color="#FFFFFF" />
              <Text style={styles.currentRideBadgeText}>ACTIVE</Text>
            </View>
          )}
        </View>
        
        <View style={[
          styles.driverInfoPreview,
          { paddingHorizontal: isCurrentRide ? 20 : 16 }
        ]}>
          <ProfilePicture 
            photoUrl={item.driverPhoto}
            size={isCurrentRide ? 60 : 50}
            style={styles.previewDriverPhoto}
          />
          <View style={styles.driverTextInfo}>
            <Text style={[
              styles.previewDriverName, 
              { 
                color: colors.textPrimary,
                fontSize: isCurrentRide ? 20 : 18,
                fontWeight: isCurrentRide ? "700" : "700",
              }
            ]}>
              {item.driverName || "Driver Name"}
            </Text>
            <Text style={[
              styles.previewRideType, 
              { 
                color: colors.accent,
                fontSize: isCurrentRide ? 16 : 15,
              }
            ]}>
              {item.rideType || "Caval Taxi"}
            </Text>
          </View>
        </View>
        
        <View style={[
          styles.rideStatus,
          { paddingHorizontal: isCurrentRide ? 20 : 16 }
        ]}>
          <View style={[
            styles.statusIndicator, 
            { 
              backgroundColor: getStatusColor(),
              width: isCurrentRide ? 10 : 8,
              height: isCurrentRide ? 10 : 8,
              borderRadius: isCurrentRide ? 5 : 4,
            }
          ]} />
          <Text style={[
            styles.rideStatusText, 
            { 
              color: colors.textPrimary,
              fontSize: isCurrentRide ? 16 : 14,
              fontWeight: isCurrentRide ? "700" : "600",
            }
          ]}>
            {getStatusText()}
          </Text>
        </View>
        
        <View style={[
          styles.infoContainer,
          { paddingHorizontal: isCurrentRide ? 20 : 16 }
        ]}>
          <View style={styles.addressRow}>
            <View style={[
              styles.bullet, 
              { 
                backgroundColor: colors.pickupColor,
                width: isCurrentRide ? 12 : 10,
                height: isCurrentRide ? 12 : 10,
                borderRadius: isCurrentRide ? 6 : 5,
              }
            ]} />
            <View style={styles.addressContainer}>
              <Text style={[
                styles.addressLabel, 
                { 
                  color: colors.textSecondary,
                  fontSize: isCurrentRide ? 13 : 12,
                }
              ]}>Départ</Text>
              <Text style={[
                styles.addressText, 
                { 
                  color: colors.textPrimary,
                  fontSize: isCurrentRide ? 16 : 15,
                }
              ]} numberOfLines={1}>
                {pickupAddr}
              </Text>
            </View>
          </View>
          
          <View style={[
            styles.verticalLine, 
            { 
              backgroundColor: colors.divider,
              height: isCurrentRide ? 16 : 14,
            }
          ]} />
          
          <View style={styles.addressRow}>
            <View style={[
              styles.bullet, 
              { 
                backgroundColor: colors.destinationColor,
                width: isCurrentRide ? 12 : 10,
                height: isCurrentRide ? 12 : 10,
                borderRadius: isCurrentRide ? 6 : 5,
              }
            ]} />
            <View style={styles.addressContainer}>
              <Text style={[
                styles.addressLabel, 
                { 
                  color: colors.textSecondary,
                  fontSize: isCurrentRide ? 13 : 12,
                }
              ]}>Destination</Text>
              <Text style={[
                styles.addressText, 
                { 
                  color: colors.textPrimary,
                  fontSize: isCurrentRide ? 16 : 15,
                }
              ]} numberOfLines={1}>
                {destinationAddr}
              </Text>
            </View>
          </View>
          
          <View style={[
            styles.divider, 
            { 
              backgroundColor: colors.divider,
              marginVertical: isCurrentRide ? 16 : 12,
            }
          ]} />
          
          <View style={styles.bottomRow}>
            <View style={styles.rideMetrics}>
              <View style={styles.metricItem}>
                <Ionicons 
                  name="speedometer-outline" 
                  size={isCurrentRide ? 18 : 16} 
                  color={colors.textSecondary} 
                />
                <Text style={[
                  styles.metricText, 
                  { 
                    color: colors.textPrimary,
                    fontSize: isCurrentRide ? 15 : 14,
                  }
                ]}>
                  {typeof item.distance === "number"
                    ? `${Number(item.distance).toFixed(1)} km`
                    : "N/A"}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons 
                  name="time-outline" 
                  size={isCurrentRide ? 18 : 16} 
                  color={colors.textSecondary} 
                />
                <Text style={[
                  styles.metricText, 
                  { 
                    color: colors.textPrimary,
                    fontSize: isCurrentRide ? 15 : 14,
                  }
                ]}>
                  {typeof item.duration === "number"
                    ? `${Number(item.duration).toFixed(0)} min`
                    : "N/A"}
                </Text>
              </View>
            </View>
            <View style={styles.fareContainer}>
              <Text style={[
                styles.fareLabel, 
                { 
                  color: colors.textSecondary,
                  fontSize: isCurrentRide ? 13 : 12,
                }
              ]}>Prix</Text>
              <Text style={[
                styles.fareText, 
                { 
                  color: colors.accent,
                  fontSize: isCurrentRide ? 20 : 18,
                  fontWeight: isCurrentRide ? "700" : "700",
                }
              ]}>
                {item.fare ? `${item.fare} Fdj` : "N/A"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Clean header with just the buttons */}
      <View style={styles.cleanHeader}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.buttonBackground }]}
          onPress={() => navigation.navigate("HomeTabs")}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Historique des courses
        </Text>
        
        <TouchableOpacity 
          style={[styles.headerButton, { backgroundColor: colors.buttonBackground }]} 
          onPress={toggleTheme}
        >
          <Ionicons 
            name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} 
            size={22} 
            color={colors.textPrimary} 
          />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={[
            { type: 'current', data: currentRides },
            { type: 'past', data: completedRides }
          ]}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={({ item }) => {
            if (item.type === 'current') {
              return (
                <View style={styles.sectionContainer}>
                  <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>
                    Course actuelle
                  </Text>
                  {item.data.length > 0 ? (
                    item.data.map((ride) => (
                      <View key={ride.id}>
                        {renderRideItem({ item: ride, isCurrentRide: true })}
                      </View>
                    ))
                  ) : (
                    <View style={[styles.emptyStateContainer, { backgroundColor: colors.cardBackground }]}>
                      <Ionicons name="car-outline" size={40} color={colors.textSecondary} />
                      <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
                        Aucune course en cours
                      </Text>
                      <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                        Vous n'avez pas de course active en ce moment
                      </Text>
                      <TouchableOpacity 
                        style={[styles.newRideButton, { backgroundColor: colors.accent }]}
                        onPress={() => navigation.navigate("Home")}
                      >
                        <Text style={styles.newRideButtonText}>Demander un taxi</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            } else if (item.type === 'past') {
              return (
                <View style={styles.sectionContainer}>
                  <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>
                    Courses passées
                  </Text>
                  {item.data.length > 0 ? (
                    item.data.map((ride) => (
                      <View key={ride.id}>
                        {renderRideItem({ item: ride, isCurrentRide: false })}
                      </View>
                    ))
                  ) : (
                    <View style={[styles.emptyStateContainer, { backgroundColor: colors.cardBackground }]}>
                      <Ionicons name="time-outline" size={40} color={colors.textSecondary} />
                      <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>
                        Aucun historique
                      </Text>
                      <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                        Vos courses terminées apparaîtront ici
                      </Text>
                    </View>
                  )}
                </View>
              );
            }
            return null;
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// Theme colors function
function getThemeColors(theme) {
  if (theme === 'dark') {
    return {
      background: '#121212',
      cardBackground: '#242424',
      previewBackground: '#2A2A2A',
      textPrimary: '#FFFFFF',
      textSecondary: '#AAAAAA',
      accent: '#FF8F00',
      accentLight: '#3D3426',
      placeholder: '#444444',
      statusActive: '#4CAF50',
      pickupColor: '#FF8F00',
      destinationColor: '#E53935',
      divider: '#333333',
      buttonBackground: '#2A2A2A',
    };
  }
  return {
    background: '#F5F5F5',
    cardBackground: '#FFFFFF',
    previewBackground: '#F9F9F9',
    textPrimary: '#333333',
    textSecondary: '#757575',
    accent: '#FF6F00',
    accentLight: '#FFF3E0',
    placeholder: '#DDDDDD',
    statusActive: '#4CAF50',
    pickupColor: '#FF8F00',
    destinationColor: '#E53935',
    divider: '#EEEEEE',
    buttonBackground: '#FFFFFF',
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  /***** CLEAN HEADER *****/
  cleanHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    marginTop: 8,
  },
  /***** LOADER / NO RIDES *****/
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noRidesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  noRidesText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  noRidesSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  newRideButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 2,
  },
  newRideButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  /***** CARD STYLES *****/
  card: {
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerLeft: {
    fontSize: 15,
    fontWeight: "600",
  },
  rideTypeContainer: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  headerRight: {
    fontSize: 14,
    fontWeight: "700",
  },
  /***** DRIVER FOUND PREVIEW *****/
  previewContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  driverInfoPreview: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewDriverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  driverTextInfo: {
    flex: 1,
  },
  previewDriverName: {
    fontSize: 18,
    fontWeight: "700",
  },
  previewRideType: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 4,
  },
  rideStatus: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  rideStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  /***** INFO CONTAINER *****/
  infoContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    marginTop: 6,
  },
  addressContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 15,
  },
  verticalLine: {
    width: 1,
    height: 14,
    marginLeft: 4.5,
    marginVertical: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rideMetrics: {
    flexDirection: "row",
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  metricText: {
    marginLeft: 4,
    fontSize: 14,
  },
  fareContainer: {
    alignItems: "flex-end",
  },
  fareLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  fareText: {
    fontSize: 18,
    fontWeight: "700",
  },
  currentRideBadge: {
    backgroundColor: '#FF8F00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  currentRideBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  emptyStateContainer: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
});

// Make sure to wrap your app with ThemeProvider
export default function ThemedActivityScreen() {
  return (
    <ThemeProvider>
      <ActivityScreen />
    </ThemeProvider>
  );
}