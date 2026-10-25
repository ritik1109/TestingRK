import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ActionButton, Field, Heading, Notice, Page } from '@/components/ui';
import { useApp } from '@/components/AppProvider';
import { apiRequest, type User } from '@/lib/api';

/** Let customers edit their service contact details and end the local session. */
export default function ProfileScreen() {
  const { user, updateUser, signOut } = useApp();
  const [name, setName] = useState(user?.name ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [pinCode, setPinCode] = useState(user?.pinCode ?? '');
  const [pinAddress, setPinAddress] = useState(user?.pinAddress ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setName(user?.name ?? '');
    setLocation(user?.location ?? '');
    setPinCode(user?.pinCode ?? '');
    setPinAddress(user?.pinAddress ?? '');
  }, [user]);

  /** Save only editable profile fields; the backend derives the account from the token. */
  async function saveProfile() {
    if (pinCode && !/^[1-9]\d{5}$/.test(pinCode.trim())) {
      setMessage('Enter a valid 6-digit PIN code.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await apiRequest<{ user: User }>('/user/profile', {
        method: 'PUT',
        body: { name, location, pinCode, pinAddress },
      });
      await updateUser(response.user);
      setMessage('Profile saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  /** Clear local credentials before returning to the public home screen. */
  async function logOut() {
    await signOut();
    router.replace('/');
  }

  if (!user) {
    return (
      <Page>
        <Heading subtitle="Sign in to manage your account details.">Profile</Heading>
        <ActionButton title="Sign in" onPress={() => router.push('/login')} />
      </Page>
    );
  }

  return (
    <Page style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Heading subtitle={`Phone: +91 ${user.phone}`}>Your profile</Heading>
        <Field accessibilityLabel="Full name" onChangeText={setName} placeholder="Full name" value={name} />
        <Field accessibilityLabel="Local area or place name" onChangeText={setLocation} placeholder="Local area / place name" value={location} />
        <Field accessibilityLabel="Six-digit postal PIN code" keyboardType="number-pad" maxLength={6} onChangeText={setPinCode} placeholder="6-digit PIN code" value={pinCode} />
        <Field accessibilityLabel="House, street, or landmark" multiline onChangeText={setPinAddress} placeholder="House, street, or landmark (optional)" value={pinAddress} />
        {message ? <Notice error={message.startsWith('Could not')}>{message}</Notice> : null}
        <ActionButton title="Save profile" loading={busy} onPress={saveProfile} />
        <ActionButton title="Sign out" onPress={logOut} secondary />
        <Text style={styles.disclosure}>Your phone and service address are used to manage service bookings.</Text>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { padding: 0 },
  content: { gap: 14, padding: 20 },
  disclosure: { color: '#A0A0A0', fontSize: 12, lineHeight: 18, marginTop: 12 },
});
