import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import PhoneNumberInput from 'react-native-phone-number-input';

// Custom wrapper component for PhoneInput
const CustomPhoneInput = ({ 
  value, 
  onChangeFormattedText, 
  containerStyle, 
  textContainerStyle, 
  textInputStyle, 
  codeTextStyle,
  defaultCode = "Djibouti" 
}) => {
  const phoneInputRef = useRef(null);
  
  return (
    <View style={styles.phoneContainer}>
      <PhoneNumberInput
        ref={phoneInputRef}
        defaultValue={value}
        defaultCode={defaultCode}
        layout="first"
        onChangeFormattedText={onChangeFormattedText}
        containerStyle={[styles.phoneInputContainer, containerStyle]}
        textContainerStyle={[styles.phoneTextContainer, textContainerStyle]}
        textInputStyle={[styles.phoneInputText, textInputStyle]}
        codeTextStyle={[styles.phoneCodeText, codeTextStyle]}
        withDarkTheme={false}
        withShadow={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  phoneContainer: {
    width: '100%',
  },
  phoneInputContainer: {
    width: '100%',
    height: 55,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  phoneTextContainer: {
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  phoneInputText: {
    fontSize: 16,
    color: '#000',
    backgroundColor: 'transparent',
  },
  phoneCodeText: {
    fontSize: 16,
    color: '#333',
    backgroundColor: 'transparent',
  },
});

export default CustomPhoneInput;