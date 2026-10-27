import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
  type TextInputFocusEvent,
} from 'react-native';
import { router } from 'expo-router';
import { ActionButton, useColors, useCommonStyles, Field, Heading, Notice, Page } from '@/components/ui';
import { BrandLogo } from '@/components/BrandLogo';
import { AnimeAvatar } from '@/components/AnimeAvatar';
import { useApp } from '@/components/AppProvider';
import { apiRequest, type User } from '@/lib/api';
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
  const colors = useColors();
  const commonStyles = useCommonStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, updateUser } = useApp();
  const [applianceId, setApplianceId] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [manualDateEntry, setManualDateEntry] = useState(false);
  const [timeSlotsVisible, setTimeSlotsVisible] = useState(false);
  const [manualTimeEntry, setManualTimeEntry] = useState(false);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [appointmentSectionY, setAppointmentSectionY] = useState<number | null>(null);
  const [headerHeight, setHeaderHeight] = useState(58);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const focusedInputTarget = useRef<number | null>(null);
  const dashboardScroll = useRef<ScrollViewInstance>(null);
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
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
      const target = focusedInputTarget.current;
      if (target !== null) {
        setTimeout(() => {
          dashboardScroll.current?.scrollResponderScrollNativeHandleToKeyboard(target, 180, true);
        }, 120);
      }
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      focusedInputTarget.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!serviceType || appointmentSectionY === null) return;
    const frame = requestAnimationFrame(() => {
      dashboardScroll.current?.scrollTo({ y: Math.max(appointmentSectionY - 12, 0), animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [appointmentSectionY, serviceType]);

  function keepFocusedFieldVisible(event: TextInputFocusEvent) {
    focusedInputTarget.current = event.nativeEvent.target;
  }

  function openCalendar() {
    Keyboard.dismiss();
    setCalendarVisible(true);
    setTimeSlotsVisible(false);
  }

  function openTimeSlots() {
    if (!validSelectedDate) return;
    Keyboard.dismiss();
    setCalendarVisible(false);
    setTimeSlotsVisible(true);
  }

  async function refreshDashboard() {
    setRefreshing(true);
    Keyboard.dismiss();
    setApplianceId(null);
    setServiceType(null);
    setPreferredDate('');
    setPreferredTime('');
    setTimeInput('');
    setDescription('');
    setCalendarVisible(false);
    setManualDateEntry(false);
    setTimeSlotsVisible(false);
    setManualTimeEntry(false);
    setMessage('');
    try {
      if (user) {
        const response = await apiRequest<{ user: User }>('/user/profile');
        await updateUser(response.user);
      } else {
        await apiRequest<{ status: string }>('/health', { skipRefresh: true });
      }
      setNow(new Date());
    } catch {
      setNow(new Date());
    } finally {
      setRefreshing(false);
    }
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
      <View
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        pointerEvents="box-none"
        style={styles.fixedHeader}
      >
        <View style={styles.dashboardHeader}>
          <BrandLogo />
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
      </View>
      <ScrollView
        ref={dashboardScroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: keyboardVisible ? keyboardHeight + 48 : 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            onRefresh={refreshDashboard}
            progressViewOffset={headerHeight}
            refreshing={refreshing}
            progressBackgroundColor={colors.card}
            tintColor={colors.accent}
          />
        }
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
              onPress={() => {
                setApplianceId(item.id);
                setServiceType(services[item.id]?.[0] ?? null);
                setPreferredDate('');
                setPreferredTime('');
                setTimeInput('');
              }}
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
            <View style={styles.dateFieldRow}>
              {manualDateEntry ? (
                <View style={styles.dateField}>
                  <Field
                    accessibilityLabel="Preferred date in year-month-day format"
                    editable
                    autoCapitalize="none"
                    onFocus={keepFocusedFieldVisible}
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
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose appointment date"
                  onPress={openCalendar}
                  style={styles.dateFieldDisplay}
                >
                  <Text style={preferredDate ? styles.dateValue : styles.datePlaceholder}>
                    {preferredDate || 'Date (YYYY-MM-DD)'}
                  </Text>
                </Pressable>
              )}
              {preferredDate ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear appointment date"
                  onPress={() => { setPreferredDate(''); setPreferredTime(''); setTimeInput(''); }}
                  style={styles.calendarButton}
                >
                  <Text style={styles.dateClear}>×</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open calendar"
                onPress={openCalendar}
                style={styles.calendarButton}
              >
                <Text style={styles.calendarButtonText}>▦</Text>
              </Pressable>
            </View>
            <Modal
              animationType="fade"
              onRequestClose={() => setCalendarVisible(false)}
              transparent
              visible={calendarVisible}
            >
              <View style={styles.calendarBackdrop}>
                <View style={styles.calendar}>
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
                            setManualDateEntry(false);
                            setCalendarVisible(false);
                          }}
                          style={[styles.dayCell, selected && styles.selected, isUnavailable && styles.unavailable]}
                        >
                          <Text style={[styles.dayText, isUnavailable && styles.unavailableText]}>{day}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={commonStyles.muted}>Choose today or a future date.</Text>
                  <View style={styles.calendarActions}>
                    <Pressable onPress={() => { setManualDateEntry(true); setCalendarVisible(false); }}>
                      <Text style={styles.calendarActionText}>Enter date manually</Text>
                    </Pressable>
                    <Pressable onPress={() => setCalendarVisible(false)}>
                      <Text style={styles.calendarActionText}>Close</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
            <View style={styles.bookingFieldGap} />
            {manualTimeEntry ? (
              <View style={styles.timeFieldRow}>
                <View style={styles.timeField}>
                  <Field
                    accessibilityLabel="Preferred time slot between 10 AM and 7 PM"
                    editable={validSelectedDate}
                    onFocus={(event) => {
                      keepFocusedFieldVisible(event);
                      setTimeSlotsVisible(false);
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
                    placeholder={validSelectedDate ? 'Time slot (e.g. 10AM-12PM)' : 'Choose a valid date first'}
                    value={timeInput}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose an available time slot"
                  disabled={!validSelectedDate}
                  onPress={openTimeSlots}
                  style={styles.calendarButton}
                >
                  <Text style={styles.calendarButtonText}>◷</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.dateFieldRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose appointment time slot"
                  disabled={!validSelectedDate}
                  onPress={openTimeSlots}
                  style={[styles.dateFieldDisplay, !validSelectedDate && styles.disabledField]}
                >
                  <Text style={preferredTime ? styles.dateValue : styles.datePlaceholder}>
                    {timeInput || (validSelectedDate ? 'Choose a time slot' : 'Choose a valid date first')}
                  </Text>
                </Pressable>
                {preferredTime ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear appointment time"
                    onPress={() => { setPreferredTime(''); setTimeInput(''); }}
                    style={styles.calendarButton}
                  >
                    <Text style={styles.dateClear}>×</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open time slots"
                  disabled={!validSelectedDate}
                  onPress={openTimeSlots}
                  style={[styles.calendarButton, !validSelectedDate && styles.disabledField]}
                >
                  <Text style={styles.calendarButtonText}>◷</Text>
                </Pressable>
              </View>
            )}
            <View style={styles.bookingFieldGap} />
            <Modal
              animationType="fade"
              onRequestClose={() => setTimeSlotsVisible(false)}
              transparent
              visible={timeSlotsVisible}
            >
              <View style={styles.calendarBackdrop}>
                <View style={styles.timePanel}>
                  <Text style={styles.timeTitle}>Available time slots</Text>
                  {availableSlots.length ? (
                    <View style={styles.timeChoices}>
                      {availableSlots.map((slot) => (
                        <Pressable
                          key={slot.value}
                          accessibilityRole="button"
                          accessibilityState={{ selected: preferredTime === slot.value }}
                          onPress={() => {
                            setPreferredTime(slot.value);
                            setTimeInput(slot.label);
                            setManualTimeEntry(false);
                            setTimeSlotsVisible(false);
                          }}
                          style={[styles.choice, preferredTime === slot.value && styles.selected]}
                        >
                          <Text style={styles.itemText}>{slot.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Notice error>No appointment slots remain today. Choose another date.</Notice>
                  )}
                  <View style={styles.calendarActions}>
                    <Pressable onPress={() => { setManualTimeEntry(true); setTimeSlotsVisible(false); }}>
                      <Text style={styles.calendarActionText}>Enter time manually</Text>
                    </Pressable>
                    <Pressable onPress={() => setTimeSlotsVisible(false)}>
                      <Text style={styles.calendarActionText}>Close</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
            <Field
              accessibilityLabel="Describe the issue (optional)"
              multiline
              onFocus={keepFocusedFieldVisible}
              onChangeText={setDescription}
              placeholder="Describe the issue (optional)"
              value={description}
            />
            <View style={styles.bookingFieldGap} />
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

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  page: { padding: 0 },
  content: { gap: 20, paddingHorizontal: 20, paddingBottom: 40 },
  fixedHeader: { backgroundColor: colors.background, elevation: colors.isDark ? 8 : 0, left: 0, paddingHorizontal: 20, paddingVertical: 10, position: 'absolute', right: 0, shadowOpacity: colors.isDark ? 0.18 : 0, top: 0, zIndex: 5 },
  dashboardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  avatarButton: { borderRadius: 24, padding: 2 },
  heroCard: { alignItems: 'center', backgroundColor: colors.hero, borderColor: colors.heroBorder, borderRadius: 20, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 142, overflow: 'hidden', padding: 20 },
  heroCopy: { flex: 1, gap: 8 },
  heroEyebrow: { color: colors.heroEyebrow, fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  heroSubtitle: { color: colors.heroText, fontSize: 13, lineHeight: 19, maxWidth: 230 },
  heroIcon: { fontSize: 46, marginLeft: 10 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: -8 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  sectionHint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  popularGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  popularCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexBasis: '48%', flexGrow: 1, gap: 5, minHeight: 126, padding: 13 },
  popularIcon: { alignItems: 'center', backgroundColor: colors.iconSurface, borderRadius: 12, height: 40, justifyContent: 'center', marginBottom: 4, width: 40 },
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
  selected: { borderColor: colors.accent, backgroundColor: colors.selected },
  dateFieldRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  bookingFieldGap: { height: 10 },
  dateField: { flex: 1 },
  dateFieldDisplay: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: 14 },
  dateValue: { color: colors.text, flex: 1, fontSize: 16 },
  datePlaceholder: { color: colors.muted, flex: 1, fontSize: 16 },
  dateClear: { color: colors.muted, fontSize: 25, lineHeight: 30 },
  calendarButton: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12, borderWidth: 1, height: 54, justifyContent: 'center', width: 54 },
  calendarButtonText: { color: colors.accent, fontSize: 22 },
  calendarBackdrop: { alignItems: 'center', backgroundColor: colors.backdrop, flex: 1, justifyContent: 'center', padding: 20 },
  calendar: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 8, maxWidth: 330, padding: 12, width: '100%' },
  calendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  monthButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 32, justifyContent: 'center', width: 36 },
  monthTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { color: colors.muted, fontSize: 10, fontWeight: '700', paddingVertical: 4, textAlign: 'center', width: '14.2857%' },
  dayCell: { alignItems: 'center', borderColor: 'transparent', borderRadius: 8, borderWidth: 1, height: 34, justifyContent: 'center', width: '14.2857%' },
  dayText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  calendarActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  calendarActionText: { color: colors.accent, fontSize: 13, fontWeight: '700', paddingVertical: 6 },
  unavailable: { opacity: 0.35 },
  unavailableText: { color: colors.muted },
  timeTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  timePanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 12, maxWidth: 330, padding: 14, width: '100%' },
  timeFieldRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  timeField: { flex: 1 },
  timeChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  disabledField: { opacity: 0.5 },
  });
}
