import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase.config';
import { getAuth } from 'firebase/auth';
import ProfilePicture from '../components/ProfilePicture';

const InboxScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Messages',
      headerStyle: { 
        backgroundColor: '#121212',
        shadowColor: 'transparent',
        elevation: 0,
      },
      headerTintColor: '#fff',
      headerTitleStyle: { 
        fontWeight: '600',
        fontSize: 18,
      },
    });

    if (currentUser) {
      fetchConversations();
    }
  }, [navigation, currentUser]);

  const fetchConversations = async () => {
    try {
      if (!currentUser?.uid) {
        console.error('No user ID available');
        setLoading(false);
        return;
      }
      
      const q = query(
        collection(firestore, 'conversations'),
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc')
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const conversationPromises = snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data() || {};
          
          if (!data.participants || !Array.isArray(data.participants)) {
            console.error('Invalid participants data for conversation:', docSnapshot.id);
            return null;
          }
          
          const otherUserId = data.participants.find(id => id !== currentUser.uid);
          
          if (!otherUserId) {
            console.error('Could not find other user in conversation:', docSnapshot.id);
            return null;
          }
          
          let userDetails = null;
          
          try {
            const customerDoc = await getDoc(doc(firestore, 'Customers', otherUserId));
            if (customerDoc.exists()) {
              userDetails = customerDoc.data();
              userDetails.type = 'customer';
            } else {
              const driverDoc = await getDoc(doc(firestore, 'Drivers', otherUserId));
              if (driverDoc.exists()) {
                userDetails = driverDoc.data();
                userDetails.type = 'driver';
              }
            }
          } catch (err) {
            console.error('Error fetching user details:', err);
          }
          
          return {
            id: docSnapshot.id,
            ...data,
            otherUser: userDetails || { firstName: 'Unknown', lastName: 'User', type: 'customer' },
          };
        });
        
        const conversationsWithDetails = (await Promise.all(conversationPromises))
          .filter(conv => conv !== null);
          
        setConversations(conversationsWithDetails);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
    }
  };

  const getInitials = (firstName, lastName) => {
    return ((firstName?.charAt(0) || '') + (lastName?.charAt(0) || '')).toUpperCase() || 'U';
  };

  const renderConversationItem = ({ item }) => {
    const currentUserId = currentUser?.uid;
    const isUnread = item.unreadCount > 0 && item.lastSenderId !== currentUserId;
    
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => navigation.navigate('CustomerInboxScreen', {
          conversationId: item.id,
          driverName: item.otherUser?.firstName + ' ' + item.otherUser?.lastName,
          driverPhoto: item.otherUser?.photo
        })}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <ProfilePicture 
            photoUrl={item.otherUser?.photo}
            size={50}
            style={[
              styles.avatar,
              item.otherUser?.type === 'driver' ? styles.driverAvatar : styles.customerAvatar
            ]}
          />
          {item.otherUser?.type === 'driver' && (
            <View style={styles.driverBadge}>
              <MaterialCommunityIcons name="steering" size={12} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[
              styles.conversationName,
              isUnread && styles.boldText
            ]} numberOfLines={1}>
              {item.otherUser?.firstName || ''} {item.otherUser?.lastName || ''}
            </Text>
            <Text style={styles.conversationTime}>
              {formatTimestamp(item.lastMessageTime)}
            </Text>
          </View>
          <View style={styles.conversationFooter}>
            <Text 
              style={[
                styles.conversationPreview,
                isUnread && styles.unreadMessage
              ]}
              numberOfLines={1}
            >
              {item.lastMessage || 'No messages yet'}
            </Text>
            {isUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{item.unreadCount || 0}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString([], { weekday: 'short' });
      }
      
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6F00" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <View style={styles.container}>
        <View style={styles.conversationsContainer}>
          <Text style={styles.sectionTitle}>Conversations</Text>
          {conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={60} color="#FF6F00" />
              </View>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Your conversations with drivers and customers will appear here
              </Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              renderItem={renderConversationItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.conversationsList}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  conversationsContainer: {
    flex: 1,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  conversationsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'rgba(50, 50, 50, 0.6)',
    borderRadius: 12,
    marginVertical: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  driverAvatar: {
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  customerAvatar: {
    borderWidth: 1,
    borderColor: '#64B5F6',
  },
  driverBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121212',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  boldText: {
    fontWeight: 'bold',
  },
  conversationTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginLeft: 4,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationPreview: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    flex: 1,
  },
  unreadMessage: {
    color: '#fff',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#FF6F00',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 111, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '80%',
  },
});

export default InboxScreen;
