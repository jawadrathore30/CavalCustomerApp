import React from 'react';
import { Text, TouchableOpacity, View, FlatList, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const data = [
    {
        id: "123",
        title: "Ready to Roll?",
        image: 'https://media.istockphoto.com/id/1354356160/vector/car-sharing-vector-icon-illustration.jpg?s=612x612&w=0&k=20&c=DQUpM1JXkZKvq1dgvyekXVMi5vxm2LlUO5dSs6hQ558=',
        screen: "MapScreen", // Name of the screen to navigate to
    },
];

const NavOptions = () => {
    const navigation = useNavigation(); // Get navigation prop

    return (
        <View style={styles.container}>
            <FlatList 
              data={data}
              keyExtractor={(item) => item.id} 
              horizontal
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={styles.optionContainer} 
                  onPress={() => navigation.navigate(item.screen)} // Navigate to MapScreen on press
                >
                    <View style={styles.innerContainer}>
                        <Image 
                            style={styles.image} 
                            source={{ uri: item.image }} 
                        />
                        <Text style={styles.title}>{item.title}</Text>
                    </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.list}
            />
            <Text style={styles.footerText}>Travel Smarter, Spend Less!</Text>
        </View>
    );
};

export default NavOptions;

const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: "#fff", // White background
    },
    optionContainer: {
      backgroundColor: "#f0f0f0", // Light gray option background
      borderRadius: 20, // Smooth rounded corners
      width: 200,
      height: 200,
      padding: 15,
      marginHorizontal: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1, // Softer shadow for a clean look
      shadowRadius: 8,
      elevation: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    innerContainer: {
      alignItems: 'center',
    },
    image: {
      width: 100,
      height: 100,
      resizeMode: 'contain',
      marginBottom: 10,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#ff9f43', // Accent color matching button style
      textAlign: 'center',
    },
    footerText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#ff9f43', // Accent footer text
      marginTop: 50,
      paddingHorizontal: 30,
      textAlign: 'center',
    },
  });
  