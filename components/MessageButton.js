import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { createDriverCustomerConversation } from '../utils/messaging';
import { getAuth } from 'firebase/auth';

/**
 * A reusable button component that allows users to start a conversation
 * Can be used in both customer and driver apps
 * 
 * @param {Object} props
 * @param {string} props.otherUserId - The ID of the user to message (customer or driver)
 * @param {string} props.userType - The type of the current user ('customer' or 'driver')
 * @param {Object} props.style - Additional styles to apply to the button
 */
const MessageButton = ({ otherUserId, userType, style }) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const handlePress = async () => {
    if (!currentUser || !otherUserId) return;
    
    try {
      setLoading(true);
      
      // Determine which ID is the customer and which is the driver
      const customerId = userType === 'customer' ? currentUser.uid : otherUserId;
      const driverId = userType === 'driver' ? currentUser.uid : otherUserId;
      
      // Create or get the conversation
      const conversationId = await createDriverCustomerConversation(driverId, customerId);
      
      // Navigate to the inbox screen with the conversation ID
      navigation.navigate('Inbox', { conversationId });
    } catch (error) {
      console.error('Error starting conversation:', error);
      // You might want to show an error message to the user here
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Ionicons name="chatbubble-outline" size={20} color="#fff" style={styles.icon} />
          <Text style={styles.text}>Message</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6F00',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default MessageButton; 