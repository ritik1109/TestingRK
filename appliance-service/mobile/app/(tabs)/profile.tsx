import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionButton, useColors, useCommonStyles, Heading, Notice, Page } from '@/components/ui';
import { AnimeAvatar } from '@/components/AnimeAvatar';
import { useApp } from '@/components/AppProvider';
import { apiRequest, type Booking } from '@/lib/api';

/** Show a friendly illustrated account home with profile editing on a separate screen. */
export default function ProfileScreen() {
  const colors = useColors();
  const commonStyles = useCommonStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, signOut } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signOutConfirmationVisible, setSignOutConfirmationVisible] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest<{ bookings: Booking[] }>('/bookings/my');
      setBookings(response.bookings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load recent bookings.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void loadBookings(); }, [loadBookings]));

  async function logOut() {
    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign out. Please try again.');
    }
  }

  function confirmLogOut() {
    setSignOutConfirmationVisible(true);
  }

  if (!user) {
    return (
      <Page>
        <Heading subtitle="Sign in to manage your account details.">Your profile</Heading>
        <ActionButton title="Sign in" onPress={() => router.push('/login')} />
      </Page>
    );
  }

  return (
    <Page style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <AnimeAvatar name={user.name || user.phone} size={76} />
          <Text style={styles.name}>{user.name}</Text>
        </View>
        <View style={commonStyles.card}>
          <Text style={styles.sectionTitle}>Personal details</Text>
          <Text style={commonStyles.muted}>Phone  ·  +91 {user.phone}</Text>
          {user.location ? <Text style={commonStyles.muted}>Area  ·  {user.location}</Text> : null}
          {user.pinCode ? <Text style={commonStyles.muted}>PIN code  ·  {user.pinCode}</Text> : null}
          {user.pinAddress ? <Text style={commonStyles.muted}>Address  ·  {user.pinAddress}</Text> : null}
          <ActionButton title="Change details" onPress={() => router.push('/profile-details')} secondary />
        </View>
        <View style={styles.bookingHeading}>
          <Text style={styles.sectionTitle}>Recent bookings</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/bookings')}>
            <Text style={styles.manageText}>Manage bookings</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Notice error>{error}</Notice> : null}
        {!loading && !error && bookings.length === 0 ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.muted}>No bookings yet. Your service requests will appear here.</Text>
          </View>
        ) : null}
        {bookings.slice(0, 4).map((booking) => (
          <Pressable
            key={booking._id}
            accessibilityRole="button"
            accessibilityLabel={`${booking.appliance}, ${booking.serviceType}, ${booking.status}. Open bookings`}
            onPress={() => router.push('/(tabs)/bookings')}
            style={commonStyles.card}
          >
            <View style={styles.bookingRow}>
              <Text style={styles.bookingTitle}>{booking.appliance}</Text>
              <Text style={[styles.status, { color: statusColor(booking.status, colors) }]}>{booking.status}</Text>
            </View>
            <Text style={commonStyles.muted}>{booking.serviceType}</Text>
            <Text style={commonStyles.muted}>{booking.preferredDate} · {booking.preferredTime}</Text>
          </Pressable>
        ))}
        <ActionButton title="Sign out" onPress={confirmLogOut} secondary />
      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={() => setSignOutConfirmationVisible(false)}
        transparent
        visible={signOutConfirmationVisible}
      >
        <View style={styles.confirmationBackdrop}>
          <View accessibilityRole="alert" style={styles.confirmationPanel}>
            <Text style={styles.confirmationTitle}>Sign out?</Text>
            <Text style={styles.confirmationMessage}>Are you sure you want to sign out?</Text>
            <View style={styles.confirmationActions}>
              <ActionButton
                title="Cancel"
                onPress={() => setSignOutConfirmationVisible(false)}
                secondary
              />
              <ActionButton
                title="Sign out"
                onPress={() => {
                  setSignOutConfirmationVisible(false);
                  void logOut();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

function statusColor(status: Booking['status'], colors: ReturnType<typeof useColors>): string {
  if (status === 'confirmed') return colors.success;
  if (status === 'rejected') return colors.error;
  if (status === 'completed') return '#60A5FA';
  return '#F59E0B';
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  page: { padding: 0 },
  content: { gap: 14, padding: 20, paddingBottom: 32 },
  identity: { alignItems: 'center', gap: 12 },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  bookingHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  manageText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  bookingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  bookingTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  confirmationBackdrop: { alignItems: 'center', backgroundColor: colors.backdrop, flex: 1, justifyContent: 'center', padding: 24 },
  confirmationPanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: 14, maxWidth: 380, padding: 20, width: '100%' },
  confirmationTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  confirmationMessage: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  confirmationActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  });
}
