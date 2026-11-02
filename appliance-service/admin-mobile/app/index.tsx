import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const TOKEN_KEY = 'rr-admin-access-token';
const PAGE_SIZE = 100;
const colors = {
  background: '#0D0D0D',
  surface: '#161616',
  card: '#1E1E1E',
  border: '#303030',
  text: '#F3F4F6',
  muted: '#A1A1AA',
  accent: '#FF6B35',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#60A5FA',
};

type AdminUser = {
  _id: string;
  name: string;
  phone: string;
  location: string;
  pinCode: string;
  pinAddress: string;
  profileComplete?: boolean;
  createdAt: string;
};

type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'completed';
type AdminBooking = {
  _id: string;
  userId?: string;
  userName: string;
  userPhone: string;
  userLocation: string;
  userPinCode?: string;
  userPinAddress?: string;
  appliance: string;
  serviceType: string;
  description: string;
  preferredDate: string;
  preferredTime: string;
  status: BookingStatus;
  createdAt: string;
};

type DashboardStats = {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  rejected: number;
  users: number;
};

type Tab = 'bookings' | 'customers';
type StatusFilter = 'all' | BookingStatus;

class AdminSessionExpiredError extends Error {}

async function request<T>(path: string, token?: string, method = 'GET', body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('API URL is missing. Configure EXPO_PUBLIC_API_URL for this EAS build.');
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      throw new AdminSessionExpiredError('Admin session expired. Please sign in again.');
    }
    throw new Error(typeof result.error === 'string' ? result.error : `Request failed (${response.status}).`);
  }
  return result as T;
}

export default function AdminHome() {
  const [token, setToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [tab, setTab] = useState<Tab>('bookings');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then(setToken)
      .catch(() => setError('Could not read the secure admin session.'))
      .finally(() => setRestoring(false));
  }, []);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [statsResponse, usersResponse, allBookings] = await Promise.all([
        request<DashboardStats>('/admin/stats', token),
        request<{ users: AdminUser[] }>('/admin/users', token),
        fetchAllBookings(token),
      ]);
      setStats(statsResponse);
      setUsers(usersResponse.users);
      setBookings(allBookings);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load admin data.';
      setError(message);
      if (loadError instanceof AdminSessionExpiredError) await signOut();
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void loadData();
  }, [loadData, token]);

  async function fetchAllBookings(accessToken: string): Promise<AdminBooking[]> {
    const all: AdminBooking[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    while (all.length < total) {
      const response = await request<{
        bookings: AdminBooking[];
        total: number;
      }>(`/admin/bookings?page=${page}&limit=${PAGE_SIZE}`, accessToken);
      all.push(...response.bookings);
      total = response.total;
      if (response.bookings.length === 0) break;
      page += 1;
    }
    return all;
  }

  async function signIn() {
    if (!username.trim() || !password) {
      setError('Enter your admin username and password.');
      return;
    }
    setLoggingIn(true);
    setError('');
    try {
      const response = await request<{ token: string }>(
        '/admin/login',
        undefined,
        'POST',
        { username: username.trim(), password },
      );
      if (!response.token) throw new Error('The server did not return an admin session.');
      await SecureStore.setItemAsync(TOKEN_KEY, response.token);
      setToken(response.token);
      setPassword('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Admin sign-in failed.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUsers([]);
    setBookings([]);
    setStats(null);
    setPassword('');
  }

  function updateBookingStatus(booking: AdminBooking, status: BookingStatus) {
    Alert.alert(
      'Update booking?',
      `Change ${booking.appliance} booking for ${booking.userName} to "${status}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Update', onPress: () => { void saveBookingStatus(booking, status); } },
      ],
    );
  }

  async function saveBookingStatus(booking: AdminBooking, status: BookingStatus) {
    if (!token) return;
    setUpdatingId(booking._id);
    setError('');
    try {
      await request(`/admin/bookings/${encodeURIComponent(booking._id)}`, token, 'PUT', { status });
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the booking.');
      if (updateError instanceof AdminSessionExpiredError) await signOut();
    } finally {
      setUpdatingId('');
    }
  }

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.name, user.phone, user.location, user.pinCode, user.pinAddress]
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [query, users]);

  const visibleBookings = useMemo(() => {
    const term = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      const statusMatches = filter === 'all' || booking.status === filter;
      const textMatches = !term || [
        booking.userName,
        booking.userPhone,
        booking.userLocation,
        booking.userPinCode,
        booking.userPinAddress,
        booking.appliance,
        booking.serviceType,
        booking.description,
        booking.preferredDate,
      ].some((value) => value?.toLowerCase().includes(term));
      return statusMatches && textMatches;
    });
  }, [bookings, filter, query]);
  const visibleRecords = useMemo<(AdminUser | AdminBooking)[]>(
    () => tab === 'bookings' ? visibleBookings : visibleUsers,
    [tab, visibleBookings, visibleUsers],
  );

  if (restoring) return <Centered><ActivityIndicator color={colors.accent} /></Centered>;

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.loginWrap}>
          <View style={styles.brandMark}><Text style={styles.brandLetters}>RR</Text></View>
          <Text style={styles.title}>Admin portal</Text>
          <Text style={styles.subtitle}>Sign in to manage bookings and customer records.</Text>
          {error ? <Notice message={error} /> : null}
          <Text style={styles.label}>Username</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
            placeholder="Admin username"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={username}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            onSubmitEditing={() => { void signIn(); }}
            placeholder="Admin password"
            placeholderTextColor={colors.muted}
            returnKeyType="go"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Pressable disabled={loggingIn} onPress={() => { void signIn(); }} style={styles.primaryButton}>
            {loggingIn ? <ActivityIndicator color="#111" /> : <Text style={styles.primaryButtonText}>Sign in</Text>}
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>RR Admin</Text>
          <Text style={styles.subtitle}>Bookings and customer records</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
      <View style={styles.statsRow}>
        <Stat label="Bookings" value={stats?.total} />
        <Stat label="Pending" value={stats?.pending} tint={colors.warning} />
        <Stat label="Customers" value={stats?.users} tint={colors.info} />
      </View>
      <View style={styles.tabRow}>
        <TabButton active={tab === 'bookings'} label={`Bookings (${stats?.total ?? 0})`} onPress={() => setTab('bookings')} />
        <TabButton active={tab === 'customers'} label={`Customers (${stats?.users ?? 0})`} onPress={() => setTab('customers')} />
      </View>
      <TextInput
        onChangeText={setQuery}
        placeholder={tab === 'bookings' ? 'Search bookings or customers' : 'Search customers'}
        placeholderTextColor={colors.muted}
        style={styles.search}
        value={query}
      />
      {tab === 'bookings' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'pending', 'confirmed', 'rejected', 'completed'] as const).map((value) => (
            <FilterButton key={value} active={filter === value} label={value} onPress={() => setFilter(value)} />
          ))}
        </ScrollView>
      ) : null}
      {error ? <Notice message={error} /> : null}
      {loading && bookings.length === 0 && users.length === 0 ? (
        <Centered><ActivityIndicator color={colors.accent} /></Centered>
      ) : (
        <FlatList<AdminUser | AdminBooking>
          contentContainerStyle={styles.list}
          data={visibleRecords}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl onRefresh={() => { void loadData(); }} refreshing={loading} tintColor={colors.accent} />}
          ListEmptyComponent={<Text style={styles.emptyText}>{loading ? 'Loading records…' : 'No matching records.'}</Text>}
          renderItem={({ item }) => 'userPhone' in item
            ? <BookingCard booking={item} updating={updatingId === item._id} onStatus={updateBookingStatus} />
            : <CustomerCard user={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

function Notice({ message }: { message: string }) {
  return <Text accessibilityRole="alert" style={styles.error}>{message}</Text>;
}

function Stat({ label, value, tint = colors.accent }: { label: string; value?: number; tint?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: tint }]}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FilterButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterButton, active && styles.filterButtonActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function BookingCard({
  booking,
  updating,
  onStatus,
}: {
  booking: AdminBooking;
  updating: boolean;
  onStatus: (booking: AdminBooking, status: BookingStatus) => void;
}) {
  return (
    <View style={styles.recordCard}>
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>{booking.appliance || 'Service booking'}</Text>
        <Text style={[styles.status, { color: statusColor(booking.status) }]}>{booking.status}</Text>
      </View>
      <Text style={styles.detail}>{booking.serviceType || 'Service type not specified'}</Text>
      <Text style={styles.detail}>Customer: {booking.userName || '—'} · {booking.userPhone || '—'}</Text>
      <Text style={styles.detail}>When: {booking.preferredDate || '—'} · {booking.preferredTime || '—'}</Text>
      <Text style={styles.detail}>Address: {[booking.userLocation, booking.userPinAddress, booking.userPinCode].filter(Boolean).join(', ') || '—'}</Text>
      {booking.description ? <Text style={styles.detail}>Request: {booking.description}</Text> : null}
      <Text style={styles.muted}>Booking ID: {booking._id}</Text>
      <View style={styles.actionRow}>
        {(['pending', 'confirmed', 'rejected', 'completed'] as const).map((status) => (
          <Pressable
            accessibilityRole="button"
            disabled={updating || booking.status === status}
            key={status}
            onPress={() => onStatus(booking, status)}
            style={[styles.statusAction, booking.status === status && styles.statusActionSelected]}
          >
            <Text style={[styles.statusActionText, booking.status === status && styles.statusActionTextSelected]}>
              {updating && booking.status !== status ? '…' : status}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CustomerCard({ user }: { user: AdminUser }) {
  return (
    <View style={styles.recordCard}>
      <Text style={styles.cardTitle}>{user.name || 'Customer'}</Text>
      <Text style={styles.detail}>Phone: {user.phone || '—'}</Text>
      <Text style={styles.detail}>Location: {user.location || '—'}</Text>
      <Text style={styles.detail}>Address: {user.pinAddress || '—'}</Text>
      <Text style={styles.detail}>PIN code: {user.pinCode || '—'}</Text>
      <Text style={styles.detail}>Profile: {user.profileComplete ? 'Complete' : 'Incomplete'}</Text>
      <Text style={styles.muted}>Joined: {formatDate(user.createdAt)}</Text>
      <Text style={styles.muted}>Customer ID: {user._id}</Text>
    </View>
  );
}

function statusColor(status: BookingStatus): string {
  if (status === 'confirmed') return colors.success;
  if (status === 'rejected') return colors.danger;
  if (status === 'completed') return colors.info;
  return colors.warning;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  loginWrap: { flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  brandMark: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.card, borderRadius: 18, height: 72, justifyContent: 'center', marginBottom: 8, width: 112 },
  brandLetters: { color: colors.accent, fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 8 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 52, paddingHorizontal: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 12, justifyContent: 'center', marginTop: 8, minHeight: 52 },
  primaryButtonText: { color: '#171717', fontSize: 16, fontWeight: '800' },
  signOutButton: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  signOutText: { color: colors.text, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 9, paddingHorizontal: 14, paddingTop: 14 },
  statCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flex: 1, padding: 12 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 14 },
  tabButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 12 },
  tabButtonActive: { backgroundColor: '#32190F', borderColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: colors.accent },
  search: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, marginHorizontal: 14, marginTop: 12, minHeight: 48, paddingHorizontal: 14 },
  filterRow: { gap: 7, paddingHorizontal: 14, paddingVertical: 10 },
  filterButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  filterButtonActive: { backgroundColor: '#32190F', borderColor: colors.accent },
  filterText: { color: colors.muted, fontSize: 12, textTransform: 'capitalize' },
  filterTextActive: { color: colors.accent, fontWeight: '700' },
  list: { gap: 10, padding: 14, paddingBottom: 28 },
  recordCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: 7, padding: 14 },
  cardHeading: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  cardTitle: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '800' },
  status: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  detail: { color: colors.text, fontSize: 13, lineHeight: 19 },
  muted: { color: colors.muted, fontSize: 11 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4 },
  statusAction: { borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
  statusActionSelected: { backgroundColor: '#32190F', borderColor: colors.accent },
  statusActionText: { color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  statusActionTextSelected: { color: colors.accent, fontWeight: '700' },
  error: { backgroundColor: '#351615', borderColor: '#7F1D1D', borderRadius: 10, borderWidth: 1, color: '#FCA5A5', marginHorizontal: 14, marginTop: 10, padding: 11 },
  emptyText: { color: colors.muted, padding: 24, textAlign: 'center' },
  centered: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
});
