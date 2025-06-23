import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  Switch,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
// import { CardField, useStripe } from '@stripe/stripe-react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { firestore } from '../firebase.config';
import { getAuth } from 'firebase/auth';

const PaymentMethodsScreen = () => {
  const navigation = useNavigation();
  // const { createPaymentMethod } = useStripe();

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultMethod, setDefaultMethod] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cardDetails, setCardDetails] = useState({});

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Méthodes de paiement',
      headerStyle: { backgroundColor: '#1E1E1E' },
      headerTintColor: '#FF6F00',
      headerTitleStyle: { fontWeight: 'bold' },
      headerLeft: () => (
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FF6F00" />
        </TouchableOpacity>
      ),
    });
    fetchPaymentMethods();
  }, [navigation]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }
    try {
      const q = query(
        collection(firestore, 'paymentMethods'),
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const methods = [];
      querySnapshot.forEach((docSnap) => {
        methods.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPaymentMethods(methods);
      const defaultMethodObj = methods.find((method) => method.isDefault);
      if (defaultMethodObj) {
        setDefaultMethod(defaultMethodObj.id);
      } else if (methods.length > 0) {
        setDefaultMethod(methods[0].id);
        setDefaultPaymentMethod(methods[0].id);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      Alert.alert('Error', 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    // Disable card payments
    Alert.alert(
      'Paiement par carte désactivé',
      'Le paiement par carte est temporairement indisponible. Veuillez utiliser le paiement en espèces.',
      [{ text: 'OK' }]
    );
    setModalVisible(false);
  };

  const addCashPaymentMethod = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to add a payment method');
        return;
      }
      
      // Check if cash payment method already exists
      const existingCashMethod = paymentMethods.find(method => method.type === 'cash');
      if (existingCashMethod) {
        Alert.alert('Info', 'Paiement en espèces déjà ajouté');
        return;
      }
      
      // Mark as default if it's the first payment method
      const isDefault = paymentMethods.length === 0 ? true : false;
      
      const methodData = {
        userId: currentUser.uid,
        type: 'cash',
        isDefault: isDefault,
        createdAt: new Date(),
        currency: 'DJF',
      };
      
      console.log('Saving cash payment method to Firestore:', methodData);
      const docRef = await addDoc(collection(firestore, 'paymentMethods'), methodData);
      const newMethod = { id: docRef.id, ...methodData };
      setPaymentMethods([...paymentMethods, newMethod]);
      if (isDefault) {
        setDefaultMethod(docRef.id);
      }
      Alert.alert('Success', 'Paiement en espèces ajouté avec succès');
    } catch (err) {
      console.error('Error adding cash payment method:', err);
      Alert.alert('Error', `Failed to add cash payment method: ${err.message}`);
    }
  };

  const removePaymentMethod = async (id) => {
    try {
      await deleteDoc(doc(firestore, 'paymentMethods', id));
      const updatedMethods = paymentMethods.filter((method) => method.id !== id);
      setPaymentMethods(updatedMethods);
      if (defaultMethod === id && updatedMethods.length > 0) {
        setDefaultMethod(updatedMethods[0].id);
        setDefaultPaymentMethod(updatedMethods[0].id);
      }
      Alert.alert('Success', 'Payment method removed');
    } catch (error) {
      console.error('Error removing payment method:', error);
      Alert.alert('Error', 'Failed to remove payment method');
    }
  };

  const setDefaultPaymentMethod = async (id) => {
    try {
      if (defaultMethod) {
        const prevDefaultDoc = doc(firestore, 'paymentMethods', defaultMethod);
        await updateDoc(prevDefaultDoc, { isDefault: false });
      }
      const newDefaultDoc = doc(firestore, 'paymentMethods', id);
      await updateDoc(newDefaultDoc, { isDefault: true });
      const updatedMethods = paymentMethods.map((method) => ({
        ...method,
        isDefault: method.id === id,
      }));
      setPaymentMethods(updatedMethods);
      setDefaultMethod(id);
      Alert.alert('Success', 'Default payment method updated');
    } catch (error) {
      console.error('Error setting default payment method:', error);
      Alert.alert('Error', 'Failed to update default payment method');
    }
  };

  const renderCardIcon = (brand) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return <FontAwesome name="cc-visa" size={28} color="#1A1F71" />;
      case 'mastercard':
        return <FontAwesome name="cc-mastercard" size={28} color="#EB001B" />;
      case 'american express':
      case 'amex':
        return <FontAwesome name="cc-amex" size={28} color="#2E77BC" />;
      default:
        return <FontAwesome name="credit-card" size={28} color="#FF6F00" />;
    }
  };

  const renderPaymentMethod = ({ item }) => (
    <View style={styles.paymentMethodCard}>
      <View style={styles.cardContent}>
        <View style={styles.cardIconContainer}>
          {item.type === 'card' ? (
            renderCardIcon(item.cardBrand)
          ) : (
            <MaterialCommunityIcons name="cash" size={28} color="#4CAF50" />
          )}
        </View>
        <View style={styles.cardDetails}>
          {item.type === 'card' ? (
            <>
              <Text style={styles.cardTitle}>•••• •••• •••• {item.lastFourDigits}</Text>
              <Text style={styles.cardSubtitle}>
                {item.cardBrand.toUpperCase()} • Expires {item.expMonth}/{item.expYear}
              </Text>
              <Text style={styles.cardCurrency}>DJF • Franc de Djibouti</Text>
            </>
          ) : (
            <Text style={styles.cardTitle}>Paiement en espèces</Text>
          )}
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.defaultButton}
          onPress={() => setDefaultPaymentMethod(item.id)}
        >
          <View style={styles.radioButton}>
            {defaultMethod === item.id && <View style={styles.radioButtonInner} />}
          </View>
          <Text style={styles.defaultText}>Par défaut</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert(
              'Supprimer la méthode de paiement',
              'Êtes-vous sûr de vouloir supprimer cette méthode de paiement?',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', onPress: () => removePaymentMethod(item.id), style: 'destructive' },
              ]
            );
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#FF6F00" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Chargement des méthodes de paiement...</Text>
        </View>
      ) : (
        <>
          <View style={styles.currencyContainer}>
            <Text style={styles.currencyText}>Devise: Franc de Djibouti (DJF)</Text>
          </View>
          {paymentMethods.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cash" size={60} color="#FF6F00" />
              <Text style={styles.emptyText}>Aucune méthode de paiement</Text>
              <Text style={styles.emptySubtext}>
                Ajoutez le paiement en espèces
              </Text>
            </View>
          ) : (
            <FlatList
              data={paymentMethods}
              renderItem={renderPaymentMethod}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
            />
          )}
          <TouchableOpacity style={styles.addButton} onPress={addCashPaymentMethod}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.addButtonText}>Ajouter le paiement en espèces</Text>
          </TouchableOpacity>
        </>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
          style={styles.modalContainer}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Paiement par carte désactivé</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#FF6F00" />
                </TouchableOpacity>
              </View>
              <View style={styles.disabledMessageContainer}>
                <MaterialCommunityIcons name="credit-card-off" size={60} color="#FF6F00" />
                <Text style={styles.disabledMessageText}>
                  Le paiement par carte est temporairement indisponible.
                </Text>
                <Text style={styles.disabledMessageSubtext}>
                  Veuillez utiliser le paiement en espèces pour vos transactions.
                </Text>
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.saveButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 16 },
  headerButton: { marginLeft: 15 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 16 },
  currencyContainer: {
    backgroundColor: '#2C2C2C',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6F00',
  },
  currencyText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  currencyBadge: {
    backgroundColor: '#FF6F00',
    borderRadius: 6,
    padding: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  currencyBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  testModeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  emptySubtext: { color: '#b3b3b3', fontSize: 14, textAlign: 'center', maxWidth: '80%' },
  listContent: { paddingBottom: 90 },
  paymentMethodCard: { backgroundColor: '#2C2C2C', borderRadius: 15, padding: 16, marginBottom: 16 },
  cardContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardDetails: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { color: '#b3b3b3', fontSize: 14 },
  cardCurrency: { color: '#FF6F00', fontSize: 12, marginTop: 4 },
  testBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: '#FF6F00',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  testBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#3C3C3C',
    paddingTop: 12,
  },
  defaultButton: { flexDirection: 'row', alignItems: 'center' },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FF6F00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioButtonInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6F00' },
  defaultText: { color: '#fff', fontSize: 14 },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3C3C3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FF6F00',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalScrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  cardInputContainer: { marginBottom: 20 },
  cardField: { width: '100%', height: 50, marginVertical: 20 },
  saveButton: { backgroundColor: '#FF6F00', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  disabledMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginVertical: 20,
  },
  disabledMessageText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
  },
  disabledMessageSubtext: {
    color: '#b3b3b3',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
});

export { PaymentMethodsScreen };