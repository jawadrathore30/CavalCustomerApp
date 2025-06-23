import { collection, addDoc, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../screens/firebase';

export const createDriverCustomerConversation = async (driverId, customerId) => {
  try {
    // Check if conversation already exists
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('driverId', '==', driverId),
      where('customerId', '==', customerId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Return existing conversation ID
      return querySnapshot.docs[0].id;
    }
    
    // Create new conversation
    const conversationRef = await addDoc(conversationsRef, {
      driverId,
      customerId,
      createdAt: new Date(),
      lastMessageAt: new Date(),
      lastMessage: '',
      unreadCount: 0
    });
    
    return conversationRef.id;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}; 