import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { testFirebaseConnection } from '../utils/firebaseTest';

const FirebaseTest = () => {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runTest = async () => {
      try {
        const result = await testFirebaseConnection();
        setTestResult(result);
      } catch (error) {
        setTestResult({
          success: false,
          error: error.message
        });
      } finally {
        setLoading(false);
      }
    };

    runTest();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Testing Firebase connection...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Connection Test</Text>
      {testResult?.success ? (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>✅ {testResult.message}</Text>
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ Test Failed</Text>
          <Text style={styles.errorMessage}>{testResult?.error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  successContainer: {
    backgroundColor: '#e6ffe6',
    padding: 10,
    borderRadius: 5,
  },
  successText: {
    color: '#006600',
  },
  errorContainer: {
    backgroundColor: '#ffe6e6',
    padding: 10,
    borderRadius: 5,
  },
  errorText: {
    color: '#cc0000',
    fontWeight: 'bold',
  },
  errorMessage: {
    color: '#cc0000',
    marginTop: 5,
  },
});

export default FirebaseTest; 