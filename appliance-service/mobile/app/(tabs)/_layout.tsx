import { Stack } from 'expo-router';
import { colors } from '@/components/ui';

/** Keep the dashboard as the app's only root page; other destinations open as pages. */
export default function AppStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Dashboard', headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: 'My profile' }} />
      <Stack.Screen name="bookings" options={{ title: 'My bookings' }} />
    </Stack>
  );
}
