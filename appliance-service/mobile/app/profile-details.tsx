import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ActionButton, colors, Field, Heading, Notice, Page } from '@/components/ui';
import { PostalAreaPicker } from '@/components/PostalAreaPicker';
import { useApp } from '@/components/AppProvider';
import { apiRequest, type User } from '@/lib/api';

/** Edit the customer's contact and service-location details. */
export default function ProfileDetailsScreen() {
  const { user, updateUser } = useApp();
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

  async function saveProfile() {
    if (!name.trim() || !location.trim()) {
      setMessage('Enter your name and local area.');
      return;
    }
    if (pinCode && !/^[1-9]\d{5}$/.test(pinCode.trim())) {
      setMessage('Enter a valid 6-digit PIN code.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await apiRequest<{ user: User }>('/user/profile', {
        method: 'PUT',
        body: {
          name: name.trim(),
          location: location.trim(),
          ...(pinCode.trim() ? { pinCode: pinCode.trim() } : {}),
          pinAddress: pinAddress.trim(),
        },
      });
      await updateUser(response.user);
      router.back();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Heading subtitle="Update the details used for your service bookings.">Change details</Heading>
        <Text style={styles.phone}>Phone number: +91 {user?.phone ?? ''}</Text>
        <Field accessibilityLabel="Full name" onChangeText={setName} placeholder="Full name" value={name} />
        <Field accessibilityLabel="Local area or place name" onChangeText={setLocation} placeholder="Local area / place name" value={location} />
        <PostalAreaPicker pinCode={pinCode} onPinCodeChange={setPinCode} />
        <Field accessibilityLabel="House, street, or landmark" multiline onChangeText={setPinAddress} placeholder="House, street, or landmark (optional)" value={pinAddress} />
        {message ? <Notice error>{message}</Notice> : null}
        <ActionButton title="Save changes" loading={busy} onPress={saveProfile} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { padding: 0 },
  content: { gap: 14, padding: 20 },
  phone: { color: colors.muted, fontSize: 14, marginBottom: 4 },
});
