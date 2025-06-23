import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import NavigateCard from '../components/NavigateCard';

// Use the same API key as other screens
const GOOGLE_API_KEY = 'AIzaSyBnVN-ACYzcA0Sy8BcPLpXG50Y9T8jhJGE';

const MapScreen = () => {
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324, 
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [fromLocation, setFromLocation] = useState(null);
  const [toLocation, setToLocation] = useState(null);
  const [route, setRoute] = useState([]);
  const navigation = useNavigation();

  const fetchRoute = async () => {
    if (!fromLocation || !toLocation) {
      Alert.alert('Error', 'Both "From" and "To" locations must be selected.');
      return;
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromLocation.latitude},${fromLocation.longitude}&destination=${toLocation.latitude},${toLocation.longitude}&key=${GOOGLE_API_KEY}`;

    try {
      console.log('Fetching directions from URL:', url);
      const response = await axios.get(url);
      console.log('API Response:', JSON.stringify(response.data, null, 2));

      if (response.data.status !== 'OK') {
        throw new Error(`API returned status: ${response.data.status}`);
      }

      if (!response.data.routes || response.data.routes.length === 0) {
        throw new Error('No routes found in the API response');
      }

      const route = response.data.routes[0];
      if (!route.overview_polyline || !route.overview_polyline.points) {
        throw new Error('No overview polyline found in the route');
      }

      const points = decodePolyline(route.overview_polyline.points);
      setRoute(points);

      if (!route.legs || route.legs.length === 0 || !route.legs[0].distance || !route.legs[0].distance.text) {
        throw new Error('Distance information not found in the route');
      }

      const distance = route.legs[0].distance.text;
      console.log('Route fetched successfully. Distance:', distance);

      // Navigate to the RideShareScreen after fetching the route
      navigation.navigate('RideSharesNearMe');
    } catch (error) {
      console.error('Error fetching directions:', error);
      let errorMessage = 'Failed to fetch the route. Please try again.';
      if (error.response) {
        console.error('Error response:', error.response.data);
        errorMessage += ` (Status: ${error.response.status})`;
      }
      Alert.alert('Error', errorMessage);
    }
  };

  const decodePolyline = (t, e = 5) => {
    let points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < t.length) {
      let b, shift = 0, result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5
      });
    }
    return points;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#1E90FF" />
      </TouchableOpacity>

      {/* "From" Search Bar */}
      <View style={styles.searchBarContainer}>
        <Text style={styles.searchLabel}>From</Text>
        <GooglePlacesAutocomplete
          placeholder="Enter starting point"
          fetchDetails={true}
          onPress={(data, details = null) => {
            if (details) {
              const location = details.geometry.location;
              setFromLocation({
                latitude: location.lat,
                longitude: location.lng,
              });
              setRegion({
                latitude: location.lat,
                longitude: location.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }
          }}
          query={{
            key: GOOGLE_API_KEY,
            language: 'en',
          }}
          styles={styles.searchInput}
          enablePoweredByContainer={false}
        />
      </View>

      {/* "To" Search Bar */}
      <View style={[styles.searchBarContainer, { top: '30%' }]}>
        <Text style={styles.searchLabel}>To</Text>
        <GooglePlacesAutocomplete
          placeholder="Enter destination"
          fetchDetails={true}
          onPress={(data, details = null) => {
            if (details) {
              const location = details.geometry.location;
              setToLocation({
                latitude: location.lat,
                longitude: location.lng,
              });
            }
          }}
          query={{
            key: GOOGLE_API_KEY,
            language: 'en',
          }}
          styles={styles.searchInput}
          enablePoweredByContainer={false}
        />
      </View>

      <TouchableOpacity style={styles.routeButton} onPress={fetchRoute}>
        <Ionicons name="car" size={24} color="#fff" />
        <View style={styles.routeButtonTextContainer}>
          <Text style={styles.routeButtonText}>Get Route</Text>
        </View>
      </TouchableOpacity>

      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={(region) => setRegion(region)}
      >
        {fromLocation && (
          <Marker coordinate={fromLocation} title="From" />
        )}
        {toLocation && (
          <Marker coordinate={toLocation} title="To" />
        )}
        {route.length > 0 && (
          <Polyline
            coordinates={route}
            strokeColor="#1E90FF"
            strokeWidth={4}
          />
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  searchBarContainer: {
    position: 'absolute',
    top: '20%',
    width: '90%',
    alignSelf: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 5,
  },
  searchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  searchInput: {
    container: {
      flex: 0,
    },
    textInput: {
      height: 38,
      color: '#5d5d5d',
      fontSize: 16,
    },
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 4,
  },
  routeButton: {
    position: 'absolute',
    bottom: 50,
    right: 20,
    backgroundColor: '#1E90FF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 6,
  },
  routeButtonTextContainer: {
    marginLeft: 10,
  },
  routeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default MapScreen;