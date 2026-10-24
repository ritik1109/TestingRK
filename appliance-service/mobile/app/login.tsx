import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ActionButton, Field, Heading, Notice, Page, commonStyles } from '@/components/ui';
import { useApp } from '@/components/AppProvider';
import { apiRequest, type User } from '@/lib/api';

type LoginStep = 'phone' | 'otp' | 'profile';

/** Handle phone verification, returning customers, and first-time profile setup. */
export default function LoginScreen() {
  const { signIn } = useApp();
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [pinAddress, setPinAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  /** Request an OTP for a ten-digit Indian phone number. */
  async function sendOtp() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setMessage('Enter a valid 10-digit phone number.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('/auth/send-otp', { method: 'POST', body: { phone: digits } });
      setPhone(digits);
      setStep('otp');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send the OTP.');
    } finally {
      setBusy(false);
    }
  }

  /** Verify the code, then either finish login or collect the new user's profile. */
  async function verifyOtp() {
    if (!/^\d{6}$/.test(otp)) {
      setMessage('Enter the six-digit code.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await apiRequest<{ token: string; user: User; isNewUser: boolean }>('/auth/verify-otp', {
        method: 'POST',
        body: { phone, otp },
      });
      setToken(response.token);
      if (response.isNewUser) {
        setStep('profile');
      } else {
        await signIn(response.token, response.user);
        router.replace('/(tabs)');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not verify the OTP.');
    } finally {
      setBusy(false);
    }
  }

  /** Complete registration with the temporary verified session before navigating. */
  async function completeProfile() {
    if (!name.trim() || !location.trim() || !pinAddress.trim()) {
      setMessage('Enter your name, city, and service address.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await apiRequest<{ user: User }>('/user/profile', {
        method: 'PUT',
        token,
        body: { name: name.trim(), location: location.trim(), pinAddress: pinAddress.trim() },
      });
      await signIn(token, response.user);
      router.replace('/(tabs)');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page style={styles.page}>
      <Heading subtitle="Use a one-time code sent to your phone number.">
        {step === 'profile' ? 'Complete your profile' : 'Sign in'}
      </Heading>
      {step === 'phone' ? (
        <>
          <Text style={commonStyles.muted}>We use your phone number to verify your account.</Text>
          <Field
            accessibilityLabel="Phone number"
            autoComplete="tel"
            keyboardType="phone-pad"
            maxLength={14}
            onChangeText={setPhone}
            placeholder="10-digit phone number"
            value={phone}
          />
          <ActionButton title="Send OTP" loading={busy} onPress={sendOtp} />
        </>
      ) : null}
      {step === 'otp' ? (
        <>
          <Text style={commonStyles.muted}>Enter the six-digit code sent to +91 {phone}.</Text>
          <Field
            accessibilityLabel="Six-digit OTP"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setOtp}
            placeholder="6-digit code"
            value={otp}
          />
          <ActionButton title="Verify and continue" loading={busy} onPress={verifyOtp} />
          <ActionButton title="Resend code" loading={busy} onPress={sendOtp} secondary />
          <ActionButton title="Use another number" onPress={() => { setStep('phone'); setMessage(''); }} secondary />
        </>
      ) : null}
      {step === 'profile' ? (
        <>
          <Field accessibilityLabel="Full name" autoComplete="name" onChangeText={setName} placeholder="Full name" value={name} />
          <Field accessibilityLabel="City or location" onChangeText={setLocation} placeholder="City or location" value={location} />
          <Field accessibilityLabel="Service address" autoComplete="street-address" multiline onChangeText={setPinAddress} placeholder="Service address" value={pinAddress} />
          <ActionButton title="Create account" loading={busy} onPress={completeProfile} />
        </>
      ) : null}
      {message ? <Notice error>{message}</Notice> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center' },
});
