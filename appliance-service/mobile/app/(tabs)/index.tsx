import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ActionButton, colors, commonStyles, Field, Heading, Notice, Page } from '@/components/ui';
import { useApp } from '@/components/AppProvider';
import { apiRequest } from '@/lib/api';
import { appliances, services } from '@/lib/catalog';

/** Present the mobile-first appliance selection and booking request flow. */
export default function HomeScreen() {
  const { user } = useApp();
  const [applianceId, setApplianceId] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const appliance = appliances.find((item) => item.id === applianceId);

  /** Submit a booking only after every required choice is present. */
  async function submitBooking() {
    if (!appliance || !serviceType || !preferredDate || !preferredTime) {
      setMessage('Choose an appliance, service, date, and preferred time.');
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('/bookings', {
        method: 'POST',
        body: {
          appliance: appliance.name,
          serviceType,
          preferredDate,
          preferredTime,
          description,
        },
      });
      setMessage('Booking request sent. You can follow its status in Bookings.');
      setServiceType(null);
      setPreferredDate('');
      setPreferredTime('');
      setDescription('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create the booking.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Heading subtitle={user ? `Welcome, ${user.name}` : 'Book a trusted home appliance service.'}>
          Home service, made simple
        </Heading>
        {!user ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.muted}>Sign in with your phone to request service and track bookings.</Text>
            <ActionButton title="Sign in with phone" onPress={() => router.push('/login')} />
          </View>
        ) : null}

        <Text style={commonStyles.sectionTitle}>1. Choose an appliance</Text>
        <View style={styles.grid}>
          {appliances.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: applianceId === item.id }}
              onPress={() => { setApplianceId(item.id); setServiceType(null); }}
              style={[styles.appliance, applianceId === item.id && styles.selected]}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={styles.itemText}>{item.name}</Text>
            </Pressable>
          ))}
        </View>

        {appliance ? (
          <>
            <Text style={commonStyles.sectionTitle}>2. Choose a service</Text>
            <View style={styles.choices}>
              {(services[appliance.id] ?? []).map((service) => (
                <Pressable
                  key={service}
                  accessibilityRole="button"
                  accessibilityState={{ selected: serviceType === service }}
                  onPress={() => setServiceType(service)}
                  style={[styles.choice, serviceType === service && styles.selected]}
                >
                  <Text style={styles.itemText}>{service}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={commonStyles.sectionTitle}>3. Preferred appointment</Text>
            <Field
              accessibilityLabel="Preferred date"
              autoCapitalize="none"
              onChangeText={setPreferredDate}
              placeholder="Date (YYYY-MM-DD)"
              value={preferredDate}
            />
            <Field
              accessibilityLabel="Preferred time"
              onChangeText={setPreferredTime}
              placeholder="Preferred time (for example, 10:00 AM)"
              value={preferredTime}
            />
            <Field
              accessibilityLabel="Describe the issue (optional)"
              multiline
              onChangeText={setDescription}
              placeholder="Describe the issue (optional)"
              value={description}
            />
            {message ? <Notice error={message.startsWith('Choose') || message.startsWith('Could not')}>{message}</Notice> : null}
            <ActionButton
              title={user ? 'Request booking' : 'Sign in to continue'}
              loading={busy}
              onPress={user ? submitBooking : () => router.push('/login')}
            />
          </>
        ) : null}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { padding: 0 },
  content: { gap: 16, padding: 20, paddingBottom: 36 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  appliance: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
    justifyContent: 'center',
    minHeight: 102,
    padding: 10,
    width: '31%',
  },
  icon: { fontSize: 27 },
  itemText: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 22, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 11 },
  selected: { borderColor: colors.accent, backgroundColor: '#32190F' },
});
