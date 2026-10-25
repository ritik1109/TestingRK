import { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ActionButton, colors, commonStyles, Field, Heading, Notice, Page } from '@/components/ui';
import { useApp } from '@/components/AppProvider';
import { apiRequest } from '@/lib/api';
import {
  appointmentSlots,
  getAvailableAppointmentSlots,
  isBookableDateKey,
  isValidDateKey,
  toDateKey,
} from '@/lib/appointment';
import { appliances, services } from '@/lib/catalog';

/** Present the mobile-first appliance selection and booking request flow. */
export default function HomeScreen() {
  const { user } = useApp();
  const [applianceId, setApplianceId] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timeSlotsVisible, setTimeSlotsVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });
  const appliance = appliances.find((item) => item.id === applianceId);
  const todayKey = toDateKey(now);
  const validSelectedDate = isValidDateKey(preferredDate) && isBookableDateKey(preferredDate, now);
  const availableSlots = validSelectedDate ? getAvailableAppointmentSlots(preferredDate, now) : [];
  const firstWeekday = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarDays: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const previousMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  const canGoToPreviousMonth = previousMonth >= new Date(now.getFullYear(), now.getMonth(), 1);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isValidDateKey(preferredDate) && preferredDate < todayKey) {
      setPreferredDate('');
      setPreferredTime('');
      setTimeInput('');
    }
  }, [preferredDate, todayKey]);

  useEffect(() => {
    if (preferredTime && !getAvailableAppointmentSlots(preferredDate, now)
      .some((slot) => slot.value === preferredTime)) {
      setPreferredTime('');
    }
  }, [now, preferredDate, preferredTime]);

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
      setTimeInput('');
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
              accessibilityLabel="Preferred date in year-month-day format"
              autoCapitalize="none"
              onFocus={() => {
                setCalendarVisible(true);
                setTimeSlotsVisible(false);
              }}
              onChangeText={(value) => {
                setPreferredDate(value);
                setPreferredTime('');
                setTimeInput('');
                if (isValidDateKey(value)) {
                  const [year, month] = value.split('-').map(Number);
                  setCalendarMonth(new Date(year, month - 1, 1));
                }
              }}
              placeholder="Date (YYYY-MM-DD)"
              value={preferredDate}
            />
            {calendarVisible ? <View style={styles.calendar}>
              <View style={styles.calendarHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  disabled={!canGoToPreviousMonth}
                  onPress={() => setCalendarMonth(previousMonth)}
                  style={[styles.monthButton, !canGoToPreviousMonth && styles.unavailable]}
                >
                  <Text style={styles.itemText}>‹</Text>
                </Pressable>
                <Text style={styles.monthTitle}>
                  {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  style={styles.monthButton}
                >
                  <Text style={styles.itemText}>›</Text>
                </Pressable>
              </View>
              <View style={styles.calendarGrid}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <Text key={day} style={styles.weekday}>{day}</Text>
                ))}
                {calendarDays.map((day, index) => {
                  if (day === null) return <View key={`empty-${index}`} style={styles.dayCell} />;
                  const dateKey = toDateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
                  const isUnavailable = !isBookableDateKey(dateKey, now);
                  const selected = dateKey === preferredDate;
                  return (
                    <Pressable
                      key={dateKey}
                      accessibilityRole="button"
                      accessibilityLabel={new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
                        .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                      accessibilityState={{ selected, disabled: isUnavailable }}
                      disabled={isUnavailable}
                      onPress={() => {
                        setPreferredDate(dateKey);
                        setPreferredTime('');
                        setTimeInput('');
                        setCalendarVisible(false);
                        Keyboard.dismiss();
                      }}
                      style={[styles.dayCell, selected && styles.selected, isUnavailable && styles.unavailable]}
                    >
                      <Text style={[styles.dayText, isUnavailable && styles.unavailableText]}>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={commonStyles.muted}>
                Choose today or a future date.
              </Text>
            </View> : null}
            <Field
              accessibilityLabel="Preferred time slot between 10 AM and 7 PM"
              editable={validSelectedDate}
              onFocus={() => {
                setTimeSlotsVisible(true);
                setCalendarVisible(false);
              }}
              onChangeText={(value) => {
                setTimeInput(value);
                const normalize = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, '');
                const matchingSlot = appointmentSlots.find((slot) =>
                  normalize(slot.value) === normalize(value) || normalize(slot.label) === normalize(value));
                setPreferredTime(
                  matchingSlot && availableSlots.some((slot) => slot.value === matchingSlot.value)
                    ? matchingSlot.value
                    : '',
                );
              }}
              placeholder={validSelectedDate ? 'Time slot (tap to choose or type)' : 'Choose a valid date first'}
              value={timeInput}
            />
            {timeSlotsVisible && validSelectedDate ? (
              availableSlots.length ? (
                <View style={styles.timePanel}>
                  <Text style={styles.timeTitle}>Available time slots (10 AM - 7 PM)</Text>
                  <View style={styles.choices}>
                  {availableSlots.map((slot) => (
                    <Pressable
                      key={slot.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: preferredTime === slot.value }}
                      onPress={() => {
                        setPreferredTime(slot.value);
                        setTimeInput(slot.label);
                        setTimeSlotsVisible(false);
                        Keyboard.dismiss();
                      }}
                      style={[styles.choice, preferredTime === slot.value && styles.selected]}
                    >
                      <Text style={styles.itemText}>{slot.label}</Text>
                    </Pressable>
                  ))}
                  </View>
                </View>
              ) : (
                <Notice error>No appointment slots remain today. Choose another date.</Notice>
              )
            ) : null}
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
  calendar: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: 12, padding: 12 },
  calendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  monthButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 40, justifyContent: 'center', width: 44 },
  monthTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { color: colors.muted, fontSize: 12, fontWeight: '700', paddingVertical: 8, textAlign: 'center', width: '14.2857%' },
  dayCell: { alignItems: 'center', borderColor: 'transparent', borderRadius: 10, borderWidth: 1, height: 42, justifyContent: 'center', width: '14.2857%' },
  dayText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  unavailable: { opacity: 0.35 },
  unavailableText: { color: colors.muted },
  timeTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  timePanel: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: 12, padding: 12 },
});
