import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase.config';
import { getAuth } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import ProfilePicture from '../components/ProfilePicture';

const CustomerInboxScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const flatListRef = useRef(null);
  const { conversationId, driverName, driverPhoto } = route.params;
  const [driverPhotoUrl, setDriverPhotoUrl] = useState(driverPhoto);

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!conversationId || !currentUser) {
      setLoading(false);
      setError('Unable to load conversation');
      return;
    }

    // Get conversation details including driver photo
    const getConversationDetails = async () => {
      try {
        const conversationRef = doc(firestore, 'conversations', conversationId);
        const conversationDoc = await getDoc(conversationRef);
        if (conversationDoc.exists()) {
          const data = conversationDoc.data();
          // Store driver photo URL in state
          if (data.driverPhoto) {
            setDriverPhotoUrl(data.driverPhoto);
          }
        }
      } catch (error) {
        console.error('Error fetching conversation details:', error);
      }
    };

    getConversationDetails();

    // Query messages for this conversation
    const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = [];
      snapshot.forEach((doc) => {
        messageList.push({ id: doc.id, ...doc.data() });
      });
      setMessages(messageList);
      setLoading(false);
      setError(null);

      // Scroll to bottom when new messages arrive
      if (flatListRef.current && messageList.length > 0) {
        setTimeout(() => {
          flatListRef.current.scrollToEnd({ animated: true });
        }, 100);
      }
    }, (error) => {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
      setLoading(false);
    });

    // Mark conversation as read for customer
    const markAsRead = async () => {
      try {
        const conversationRef = doc(firestore, 'conversations', conversationId);
        await updateDoc(conversationRef, {
          'readBy.customer': true,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error marking conversation as read:', error);
      }
    };

    markAsRead();

    return () => unsubscribe();
  }, [conversationId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Add message to conversation
      const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
      const messageRef = await addDoc(messagesRef, {
        text: newMessage.trim(),
        senderId: currentUser.uid,
        senderType: 'customer',
        timestamp: serverTimestamp(),
        status: 'sending'
      });

      // Update message status to sent
      await updateDoc(doc(firestore, 'conversations', conversationId, 'messages', messageRef.id), {
        status: 'sent'
      });

      // Update conversation's last message
      const conversationRef = doc(firestore, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        lastMessage: newMessage.trim(),
        lastMessageTime: serverTimestamp(),
        lastMessageSender: currentUser.uid,
        updatedAt: serverTimestamp(),
        'readBy.driver': false
      });

      setNewMessage('');
      setError(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const isCustomer = item.senderId === currentUser.uid;
    const messageTime = item.timestamp?.toDate();
    const formattedTime = messageTime ? formatDistanceToNow(messageTime, { addSuffix: true }) : '';

    return (
      <View style={[
        styles.messageContainer,
        isCustomer ? styles.customerMessage : styles.driverMessage
      ]}>
        {!isCustomer && (
          <ProfilePicture 
            photoUrl={driverPhotoUrl}
            size={40}
            style={styles.avatar}
          />
        )}
        <View style={[
          styles.messageBubble,
          isCustomer ? styles.customerBubble : styles.driverBubble
        ]}>
          <Text style={styles.messageText}>{item.text}</Text>
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>{formattedTime}</Text>
            {isCustomer && (
              <Icon
                name={item.status === 'sending' ? 'time' : 'checkmark-done'}
                size={16}
                color={item.status === 'sent' ? '#4CAF50' : '#666'}
                style={styles.statusIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3E98FF" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40}
      >
        <View style={styles.mainContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <ProfilePicture 
                photoUrl={driverPhotoUrl}
                size={40}
                style={styles.headerAvatar}
              />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerName}>{driverName || 'Driver'}</Text>
                <Text style={styles.onlineStatus}>Online</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.moreButton}>
              <Icon name="ellipsis-vertical" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={16} color="#fff" style={styles.errorIcon} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            onLayout={() => flatListRef.current?.scrollToEnd()}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Icon name="attach" size={24} color="#888" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: '#1e1e1e',
  },
  mainContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 4,
    paddingTop: Platform.OS === 'ios' ? 15 : 4,
    marginTop: Platform.OS === 'android' ? 20 : 60,
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 4,
  },
  moreButton: {
    padding: 4,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  headerName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  onlineStatus: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 2,
  },
  messagesList: {
    padding: 12,
    paddingBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  customerMessage: {
    justifyContent: 'flex-end',
  },
  driverMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  customerBubble: {
    backgroundColor: '#FF6F00',
    borderTopRightRadius: 4,
  },
  driverBubble: {
    backgroundColor: '#333',
    borderTopLeftRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginRight: 4,
  },
  statusIcon: {
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 24,
    backgroundColor: '#1e1e1e',
    borderTopWidth: 1,
    borderTopColor: '#333',
    elevation: 5,
    zIndex: 1000,
    minHeight: Platform.OS === 'android' ? 90 : 60,
    marginBottom: Platform.OS === 'android' ? 20 : 0,
  },
  attachButton: {
    marginRight: 8,
    padding: 4,
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#FF6F00',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: '#ff4444',
    padding: 8,
    alignItems: 'center',
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default CustomerInboxScreen;