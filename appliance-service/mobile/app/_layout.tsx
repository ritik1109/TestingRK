import { Stack, router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '@/components/AppProvider';
import { colors } from '@/components/ui';

/** Set up shared state, safe-area-aware navigation, and platform status styling. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}

/** Restore the customer session and keep authenticated routes behind sign-in. */
function RootNavigator() {
  const { ready, user } = useApp();
  const segments = useSegments();
  const currentRoute = segments[0];
  const needsLogin = ready && !user && currentRoute !== 'login';
  const needsHome = ready && Boolean(user) && currentRoute === 'login';

  useEffect(() => {
    if (needsLogin) router.replace('/login');
    if (needsHome) router.replace('/(tabs)');
  }, [needsHome, needsLogin]);

  if (!ready || needsLogin || needsHome) return <BrandSplash />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profile-details" options={{ title: 'Change details', headerBackTitle: 'Profile' }} />
      <Stack.Screen name="login" options={{ title: 'Sign in', headerShown: false }} />
    </Stack>
  );
}

/** Show the app's branded mark while a saved session is restored. */
function BrandSplash() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading RR Appliance Service" style={styles.loading}>
      <View style={styles.logo}>
        <Text style={styles.logoFirst}>R</Text>
        <Text style={styles.logoSecond}>R</Text>
      </View>
      <Text style={styles.brand}>RR CONSULTANCY</Text>
      <Text style={styles.tagline}>Appliance Service</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
  logo: {
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 15,
    flexDirection: 'row',
    height: 76,
    justifyContent: 'center',
    marginBottom: 18,
    width: 142,
  },
  logoFirst: { color: colors.text, fontSize: 46, fontWeight: '700', marginRight: 5 },
  logoSecond: { color: colors.accent, fontSize: 46, fontWeight: '700' },
  brand: { color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  tagline: { color: colors.muted, fontSize: 14, marginTop: 8 },
});
