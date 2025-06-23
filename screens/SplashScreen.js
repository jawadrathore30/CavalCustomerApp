import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import CavalLogo from "../assets/Caval_Logo-removebg-preview.png";
import { Image } from 'react-native';

const SplashScreen = ({ onFinish }) => {
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start animations
    const startAnimations = async () => {
      // Logo fade in
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Breathing animation
      const breathingAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(logoScale, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );

      breathingAnimation.start();

      // Fade out and finish after 3 seconds
      setTimeout(() => {
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          onFinish();
        });
      }, 3000);
    };

    startAnimations();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
      <LinearGradient
        colors={['#121212', '#1a1a1a', '#212121']}
        style={styles.gradient}
      >
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        
        <View style={styles.content}>
          {/* Logo with breathing animation */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image source={CavalLogo} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
});

export default SplashScreen; 