import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { initDB } from './src/database/db';

import Dashboard from './src/screens/Dashboard';
import ProductList from './src/screens/ProductList';
import AddEditProduct from './src/screens/AddEditProduct';
import Cashier from './src/screens/Cashier';
import Report from './src/screens/Report';
import AiAssistant from './src/screens/AiAssistant';
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDB().then(() => setDbReady(true));
  }, []);

  if (!dbReady) {
    return (
      <SafeAreaProvider>
        <View style={splashStyles.container}>
          <Text style={splashStyles.emoji}>🏪</Text>
          <Text style={splashStyles.title}>Warung Mamah</Text>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
          <Text style={splashStyles.sub}>Memuat aplikasi...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" backgroundColor="transparent" translucent />
        <Stack.Navigator
          initialRouteName="Dashboard"
          screenOptions={{
            headerShown: false, // Gunakan custom header di semua layar agar seragam & premium
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen name="Dashboard" component={Dashboard} />
          <Stack.Screen name="ProductList" component={ProductList} />
          <Stack.Screen name="AddEditProduct" component={AddEditProduct} />
          <Stack.Screen name="Cashier" component={Cashier} />
          <Stack.Screen name="Report" component={Report} />
          <Stack.Screen name="AiAssistant" component={AiAssistant} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: colors.primary },
  sub: { fontSize: 14, color: colors.textLight, marginTop: 12 },
});
