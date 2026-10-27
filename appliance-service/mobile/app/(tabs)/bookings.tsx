import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionButton, useColors, useCommonStyles, Heading, Notice, Page } from '@/components/ui';
import { useApp } from '@/components/AppProvider';
import { apiRequest, type Booking } from '@/lib/api';
import { router } from 'expo-router';

/** Show the signed-in customer's booking history and current service status. */
export default function BookingsScreen() {
  const colors = useColors();
  const commonStyles = useCommonStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /** Refresh bookings when this tab becomes visible so status changes appear promptly. */
  const loadBookings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest<{ bookings: Booking[] }>('/bookings/my');
      setBookings(response.bookings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load bookings.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void loadBookings(); }, [loadBookings]));

  if (!user) {
    return (
      <Page>
        <Heading subtitle="Sign in to see appointment requests and their status.">My bookings</Heading>
        <ActionButton title="Sign in" onPress={() => router.push('/login')} />
      </Page>
    );
  }

  return (
    <Page style={styles.page}>
      <Heading subtitle="See your requested appointments and current status.">My bookings</Heading>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Notice error>{error}</Notice> : null}
      {!loading && !error && bookings.length === 0 ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.muted}>No bookings yet. Choose an appliance on Home to get started.</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.list}>
        {bookings.map((booking) => (
          <View key={booking._id} style={commonStyles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>{booking.appliance}</Text>
              <Text style={[styles.status, { color: statusColor(booking.status, colors) }]}>{booking.status}</Text>
            </View>
            <Text style={commonStyles.muted}>{booking.serviceType}</Text>
            <Text style={commonStyles.muted}>{booking.preferredDate} · {booking.preferredTime}</Text>
            {booking.description ? <Text style={commonStyles.muted}>{booking.description}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </Page>
  );
}

/** Map each server booking state to a readable semantic color. */
function statusColor(status: Booking['status'], colors: ReturnType<typeof useColors>): string {
  if (status === 'confirmed') return colors.success;
  if (status === 'rejected') return colors.error;
  if (status === 'completed') return colors.info;
  return colors.warning;
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  page: { paddingBottom: 0 },
  list: { gap: 12, paddingBottom: 24 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '700' },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  });
}
