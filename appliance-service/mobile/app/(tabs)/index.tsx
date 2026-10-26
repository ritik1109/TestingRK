import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
  type TextInputFocusEvent,
} from 'react-native';
import { router } from 'expo-router';
import { ActionButton, colors, commonStyles, Field, Heading, Notice, Page } from '@/components/ui';
import { AnimeAvatar } from '@/components/AnimeAvatar';
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
  const [appointmentSectionY, setAppointmentSectionY] = useState<number | null>(null);
  const [headerHeight, setHeaderHeight] = useState(58);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollOffset = useRef(0);
  const hideHeaderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboardScroll = useRef<ScrollViewInstance>(null);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
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
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(headerTranslateY, {
      toValue: headerVisible ? 0 : -headerHeight,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [headerHeight, headerTranslateY, headerVisible]);

  useEffect(() => () => {
    if (hideHeaderTimer.current) clearTimeout(hideHeaderTimer.current);
  }, []);

  useEffect(() => {
    if (!serviceType || appointmentSectionY === null) return;
    const frame = requestAnimationFrame(() => {
      dashboardScroll.current?.scrollTo({ y: Math.max(appointmentSectionY - 12, 0), animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [appointmentSectionY, serviceType]);

  function onDashboardScroll(event: { nativeEvent: { contentOffset: { y: number } } }) {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    if (hideHeaderTimer.current) clearTimeout(hideHeaderTimer.current);
    setHeaderVisible(true);
    if (!keyboardVisible && scrollOffset.current > 80) {
      hideHeaderTimer.current = setTimeout(() => setHeaderVisible(false), 750);
    }
  }

  function keepFocusedFieldVisible(event: TextInputFocusEvent) {
    setHeaderVisible(true);
    if (hideHeaderTimer.current) clearTimeout(hideHeaderTimer.current);
    requestAnimationFrame(() => {
      dashboardScroll.current?.scrollResponderScrollNativeHandleToKeyboard(
        event.nativeEvent.target,
        140,
        true,
      );
    });
  }

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
      <Animated.View
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        style={[styles.fixedHeader, { transform: [{ translateY: headerTranslateY }] }]}
      >
        <View style={styles.dashboardHeader}>
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoR}>R</Text>
              <Text style={styles.logoRAccent}>R</Text>
            </View>
            <Text style={styles.brandName}>RR SERVICE</Text>
          </View>
          {user ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open your profile"
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.avatarButton}
            >
              <AnimeAvatar name={user.name || user.phone} size={44} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
      <ScrollView
        ref={dashboardScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScroll={onDashboardScroll}
        scrollEventThrottle={16}
      >
        <View style={{ height: headerHeight }} />
        <Heading subtitle={user ? `Welcome back, ${user.name}` : 'Reliable care for every appliance at home.'}>
          Home service,{'\n'}made simple.
        </Heading>
        <View style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>CARE FOR YOUR HOME</Text>
            <Text style={styles.heroTitle}>Repairs made easy.</Text>
            <Text style={styles.heroSubtitle}>Choose a service and find a time that works for you.</Text>
          </View>
          <Text style={styles.heroIcon}>🛠️</Text>
        </View>
        {!user ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.muted}>Sign in with your phone to request service and track bookings.</Text>
            <ActionButton title="Sign in with phone" onPress={() => router.push('/login')} />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular services</Text>
          <Text style={styles.sectionHint}>Quick start</Text>
        </View>
        <View style={styles.popularGrid}>
          {[
            { appliance: 'ac', title: 'AC service', detail: 'Clean & cool', icon: '❄️', service: 'Service/Clean' },
            { appliance: 'washing', title: 'Washer repair', detail: 'Back in action', icon: '🫧', service: 'Repair' },
            { appliance: 'fridge', title: 'Fridge repair', detail: 'Keep it fresh', icon: '🧊', service: 'Repair' },
            { appliance: 'ro', title: 'RO service', detail: 'Fresh water', icon: '💧', service: 'Service/Clean' },
          ].map((item) => (
            <Pressable
              key={item.appliance}
              accessibilityRole="button"
              onPress={() => { setApplianceId(item.appliance); setServiceType(item.service); }}
              style={styles.popularCard}
            >
              <View style={styles.popularIcon}><Text style={styles.popularEmoji}>{item.icon}</Text></View>
              <Text style={styles.popularTitle}>{item.title}</Text>
              <Text style={styles.popularDetail}>{item.detail}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All appliances</Text>
          <Text style={styles.sectionHint}>12 categories</Text>
        </View>
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
            <View onLayout={(event) => setAppointmentSectionY(event.nativeEvent.layout.y)}>
            <Text style={commonStyles.sectionTitle}>3. Preferred appointment</Text>
            <Field
              accessibilityLabel="Preferred date in year-month-day format"
              autoCapitalize="none"
              onFocus={(event) => {
                keepFocusedFieldVisible(event);
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
              onFocus={(event) => {
                keepFocusedFieldVisible(event);
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
              onFocus={keepFocusedFieldVisible}
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
            </View>
          </>
        ) : null}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { padding: 0 },
  content: { gap: 20, paddingHorizontal: 20, paddingBottom: 40 },
  fixedHeader: { backgroundColor: colors.background, elevation: 8, left: 0, paddingHorizontal: 20, paddingVertical: 10, position: 'absolute', right: 0, top: 0, zIndex: 5 },
  dashboardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  logoMark: { alignItems: 'center', backgroundColor: '#171717', borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', height: 38, justifyContent: 'center', width: 48 },
  logoR: { color: colors.text, fontSize: 23, fontWeight: '800' },
  logoRAccent: { color: colors.accent, fontSize: 23, fontWeight: '800', marginLeft: -2 },
  brandName: { color: colors.text, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  avatarButton: { borderRadius: 24, padding: 2 },
  heroCard: { alignItems: 'center', backgroundColor: '#25160F', borderColor: '#57301F', borderRadius: 20, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 142, overflow: 'hidden', padding: 20 },
  heroCopy: { flex: 1, gap: 8 },
  heroEyebrow: { color: '#FFB18D', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  heroSubtitle: { color: '#D2B6A8', fontSize: 13, lineHeight: 19, maxWidth: 230 },
  heroIcon: { fontSize: 46, marginLeft: 10 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: -8 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  sectionHint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  popularGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  popularCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexBasis: '48%', flexGrow: 1, gap: 5, minHeight: 126, padding: 13 },
  popularIcon: { alignItems: 'center', backgroundColor: '#30231E', borderRadius: 12, height: 40, justifyContent: 'center', marginBottom: 4, width: 40 },
  popularEmoji: { fontSize: 22 },
  popularTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  popularDetail: { color: colors.muted, fontSize: 12 },
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
