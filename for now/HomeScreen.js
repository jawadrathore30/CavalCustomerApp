import React from "react";
import { SafeAreaView, View, Image, StyleSheet } from "react-native";
import tw from "tailwind-react-native-classnames";
import NavOptions from "./navOptions";

const HomeScreen = () => {
  return (
    <SafeAreaView style={tw`bg-white h-full`}>
      <View style={[tw`p-1`, styles.container]}>
        <View style={styles.imageContainer}>
          <Image
            style={styles.logo}
            source={{
              uri: "https://www.ecopool.com/assets/img/ecopool-meta.png",
            }}
          />
        </View>

        {/* Render the NavOptions */}
        <NavOptions />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff", // Clean white background
  },
  imageContainer: {
    alignItems: "center",
    marginTop: -30,
  },
  logo: {
    width: 300,
    height: undefined,
    aspectRatio: 1,
    resizeMode: "contain",
    marginBottom: 40,
  },
});



export default HomeScreen;
