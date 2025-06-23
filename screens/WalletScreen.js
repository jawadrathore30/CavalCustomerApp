import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  SafeAreaView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";

const WalletScreen = () => {
  const navigation = useNavigation();

  // Example static data (replace with real data from your database if needed)
  const [balance, setBalance] = useState(200.0);
  const [transactions, setTransactions] = useState([
    {
      id: "1",
      date: "2025-02-26",
      time: "10:30 AM",
      description: "Taxi Ride Payment",
      amount: -15.5,
    },
    {
      id: "2",
      date: "2025-02-25",
      time: "08:15 PM",
      description: "Wallet Top-Up",
      amount: +50.0,
    },
  ]);

  // Renders a single transaction item
  const renderTransaction = ({ item }) => {
    const isPositive = item.amount > 0;
    return (
      <View style={styles.transactionItem}>
        <View>
          <Text style={styles.transactionDescription}>{item.description}</Text>
          <Text style={styles.transactionDate}>
            {item.date} • {item.time}
          </Text>
        </View>
        <Text
          style={[
            styles.transactionAmount,
            { color: isPositive ? "green" : "red" },
          ]}
        >
          {isPositive ? `+${item.amount}` : `${item.amount}`} Fdj
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          {/* Optional back button; if you have a back navigation */}
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>My Wallet</Text>

          {/* Placeholder for spacing on the right (to center title) */}
          <View style={{ width: 24 }} />
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{balance.toFixed(2)} Fdj</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons
              name="add-circle-outline"
              size={20}
              color="#FFF"
              style={styles.actionButtonIcon}
            />
            <Text style={styles.actionButtonText}>Add Funds</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons
              name="card-outline"
              size={20}
              color="#FFF"
              style={styles.actionButtonIcon}
            />
            <Text style={styles.actionButtonText}>Payment Methods</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction List */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length === 0 ? (
          <Text style={styles.noTransactions}>No transactions yet.</Text>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderTransaction}
            contentContainerStyle={styles.transactionsList}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default WalletScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },
  scrollContainer: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  balanceCard: {
    backgroundColor: "#FF6F00",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 16,
    color: "#FFF",
    marginBottom: 5,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFF",
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: "row",
    backgroundColor: "#FF6F00",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: "center",
    width: "48%",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
  },
  noTransactions: {
    textAlign: "center",
    color: "#555",
    fontSize: 16,
    marginVertical: 10,
  },
  transactionsList: {
    paddingBottom: 20,
  },
  transactionItem: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: "#666",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
});
