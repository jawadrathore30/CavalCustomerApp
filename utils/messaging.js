import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../screens/firebase';

/**
 * Creates a new conversation between a customer and a driver
 * @param {string} customerId - The ID of the customer
 * @param {string} driverId - The ID of the driver
 * @returns {Promise<string>} - The ID of the created conversation
 */
export const createConversation = async (customerId, driverId) => {
  try {
    // Check if conversation already exists
    const existingConversation = await findExistingConversation(customerId, driverId);
    if (existingConversation) {
      return existingConversation.id;
    }

    // Create new conversation
    const conversationData = {
      participants: [customerId, driverId],
      createdAt: serverTimestamp(),
      lastMessageTime: serverTimestamp(),
      customerId,
      driverId,
    };

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

/**
 * Finds an existing conversation between a customer and a driver
 * @param {string} customerId - The ID of the customer
 * @param {string} driverId - The ID of the driver
 * @returns {Promise<Object|null>} - The conversation document or null if not found
 */
export const findExistingConversation = async (customerId, driverId) => {
  try {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', customerId)
    );

    const querySnapshot = await getDocs(q);
    
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      if (data.participants.includes(driverId)) {
        return { id: doc.id, ...data };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding conversation:', error);
    throw error;
  }
};

/**
 * Sends a message in a conversation
 * @param {string} conversationId - The ID of the conversation
 * @param {string} senderId - The ID of the sender
 * @param {string} text - The message text
 * @returns {Promise<string>} - The ID of the created message
 */
export const sendMessage = async (conversationId, senderId, text) => {
  try {
    // Add message to the conversation
    const messageData = {
      text,
      senderId,
      timestamp: serverTimestamp(),
    };
    
    const messageRef = await addDoc(
      collection(db, `conversations/${conversationId}/messages`), 
      messageData
    );
    
    // Update conversation's last message
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
      lastSenderId: senderId,
    });
    
    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

/**
 * Marks a conversation as read for a user
 * @param {string} conversationId - The ID of the conversation
 * @param {string} userId - The ID of the user
 */
export const markConversationAsRead = async (conversationId, userId) => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      [`unreadCount.${userId}`]: 0,
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    throw error;
  }
};

/**
 * Gets user details (customer or driver)
 * @param {string} userId - The ID of the user
 * @returns {Promise<Object>} - The user details
 */
export const getUserDetails = async (userId) => {
  try {
    // Try to get from Customers collection first
    const customerDoc = await getDoc(doc(db, 'Customers', userId));
    if (customerDoc.exists()) {
      return { ...customerDoc.data(), type: 'customer' };
    }
    
    // If not in Customers, try Drivers collection
    const driverDoc = await getDoc(doc(db, 'Drivers', userId));
    if (driverDoc.exists()) {
      return { ...driverDoc.data(), type: 'driver' };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user details:', error);
    throw error;
  }
};

/**
 * Creates a conversation between a driver and a customer
 * @param {string} driverId - The ID of the driver
 * @param {string} customerId - The ID of the customer
 * @returns {Promise<string>} - The ID of the created conversation
 */
export const createDriverCustomerConversation = async (driverId, customerId) => {
  try {
    // Check if conversation already exists
    const existingConversation = await findExistingConversation(customerId, driverId);
    if (existingConversation) {
      return existingConversation.id;
    }

    // Create new conversation
    const conversationData = {
      participants: [customerId, driverId],
      createdAt: serverTimestamp(),
      lastMessageTime: serverTimestamp(),
      customerId,
      driverId,
      unreadCount: {
        [customerId]: 0,
        [driverId]: 0
      }
    };

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating driver-customer conversation:', error);
    throw error;
  }
}; 