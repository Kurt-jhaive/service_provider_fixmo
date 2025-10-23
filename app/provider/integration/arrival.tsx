import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ArrivalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Arrival Screen</Text>
    </View>
  );
}
// test
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
  },
});
