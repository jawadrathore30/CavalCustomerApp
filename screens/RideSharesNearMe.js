import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Sample data for drivers, distances, fares, total time, and car types with image URLs
const rideShares = [
  { id: 1, company: 'Taxi', driver: 'John', fare: '620 fdj', distance: '2 km', eta: '5 mins', totalTime: '22 mins', passengers: 3, carType: 'sedan', carImage: 'https://t3.ftcdn.net/jpg/04/72/22/46/360_F_472224646_wWhnzKdHraRcju8NZhME0N2WurlGCjU7.webp' },
  { id: 2, company: 'Private', driver: 'Sarah', fare: '575 fdj', distance: '3 km', eta: '7 mins', totalTime: '16 mins', passengers: 2, carType: 'van', carImage: 'https://t3.ftcdn.net/jpg/04/72/22/46/360_F_472224646_wWhnzKdHraRcju8NZhME0N2WurlGCjU7.webp' },
  { id: 3, company: 'Taxi', driver: 'Mike', fare: '610 fdj', distance: '4 km', eta: '10 mins', totalTime: '27 mins', passengers: 4, carType: 'suv', carImage: 'https://t3.ftcdn.net/jpg/04/15/31/60/360_F_415316078_2mM328XtRXgDzu3leOVH1HtGjujXMfcF.jpg' },
];

const RideSharesNearMe = () => {
  const navigation = useNavigation();

  const renderRideShareItem = ({ item }) => {
    // Remove dollar sign and convert fare to number for calculation
    const fareAmount = parseFloat(item.fare.replace('fdj', ''));
    const splitFare = (fareAmount / item.passengers).toFixed(2);

    return (
      <View style={styles.rideShareCard}>
        <View style={styles.header}>
          <Text style={styles.companyText}>{item.company}</Text>
          <Text style={styles.passengerCount}>
            <FontAwesome5 name="user-friends" size={14} color="#1E90FF" /> {item.passengers} Passengers
          </Text>
        </View>
        <View style={styles.infoContainer}>
          <View style={styles.details}>
            <Text style={styles.driverText}>Driver: {item.driver}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="cash" size={20} color="#32CD32" />
              <Text style={styles.fareText}>{splitFare} fdj</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#FF6347" />
              <Text style={styles.infoText}>Distance: {item.distance}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color="#1E90FF" />
              <Text style={styles.infoText}>ETA: {item.eta}</Text>
            </View>
            <Text style={styles.totalFareText}>
              Total: {item.fare}
            </Text>
            <Text style={styles.totalTimeText}>
              Est. Ride Time: {item.totalTime}
            </Text>
          </View>
          <Image source={{ uri: item.carImage }} style={styles.carImage} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#1E90FF" />
      </TouchableOpacity>
      <Text style={styles.title}>Nearby Ride Shares</Text>
      <FlatList
        data={rideShares}
        renderItem={renderRideShareItem}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 60,
    marginBottom: 10,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  rideShareCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  companyText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  passengerCount: {
    fontSize: 14,
    color: '#1E90FF',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  details: {
    flex: 1,
    paddingRight: 10,
  },
  carImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  driverText: {
    fontSize: 16,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  fareText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#32CD32',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  totalFareText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'right',
    color: '#333',
  },
  totalTimeText: {
    fontSize: 16,
    marginTop: 5,
    textAlign: 'right',
    color: '#333',
  },
  infoText: {
    fontSize: 16,
    marginLeft: 8,
  },
});

export default RideSharesNearMe;
