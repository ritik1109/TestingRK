import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ActionButton, Field, Heading, Notice, Page, commonStyles } from '@/components/ui';
import { PostalAreaPicker } from '@/components/PostalAreaPicker';
import { useApp } from '@/components/AppProvider';
import { apiRequest, type User } from '@/lib/api';

type LoginStep = 'phone' | 'otp' | 'profile';
type AuthMode = 'signup' | 'signin';

/** Handle phone verification, returning customers, and first-time profile setup. */
export default function LoginScreen() {
  const { signIn } = useApp();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [pinAddress, setPinAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  /** Let the customer switch between registration and returning-customer login. */
  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage('');
    if (step !== 'otp') setStep('phone');
  }

  /** Request an OTP for a ten-digit Indian phone number. */
  async function sendOtp() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setMessage('Enter a valid 10-digit phone number.');
      return;
    }
    if (mode === 'signup' && (!name.trim() || !location.trim() || !/^[1-9]\d{5}$/.test(pinCode.trim()))) {
      setMessage('Enter your name, area, and a valid 6-digit PIN code before continuing.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('/auth/send-otp', { method: 'POST', body: { phone: digits, intent: mode } });
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
      const response = await apiRequest<{
        token: string;
        refreshToken: string;
        user: User;
        isNewUser: boolean;
      }>('/auth/verify-otp', {
        method: 'POST',
        body: { phone, otp, intent: mode },
      });
      if (typeof response.token !== 'string' || typeof response.refreshToken !== 'string') {
        throw new Error('The backend needs the latest update to support persistent sign-in. Please restart the backend and try again.');
      }
      setToken(response.token);
      setRefreshToken(response.refreshToken);
      if (response.isNewUser) {
        setStep('profile');
        if (mode === 'signup') {
          const profile = await apiRequest<{ user: User }>('/user/profile', {
            method: 'PUT',
            token: response.token,
            body: {
              name: name.trim(),
              location: location.trim(),
              pinCode: pinCode.trim(),
              pinAddress: pinAddress.trim(),
            },
          });
          await signIn(response.token, response.refreshToken, profile.user);
          router.replace('/(tabs)');
        }
      } else {
        await signIn(response.token, response.refreshToken, response.user);
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
    if (!name.trim() || !location.trim() || !/^[1-9]\d{5}$/.test(pinCode.trim()) || pinAddress.length > 300) {
      setMessage('Enter your name, verify your PIN code, select your area, and keep the address under 300 characters.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await apiRequest<{ user: User }>('/user/profile', {
        method: 'PUT',
        token,
        body: {
          name: name.trim(),
          location: location.trim(),
          pinCode: pinCode.trim(),
          pinAddress: pinAddress.trim(),
        },
      });
      await signIn(token, refreshToken, response.user);
      router.replace('/(tabs)');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Heading subtitle={
        step === 'profile'
          ? mode === 'signup'
            ? 'Your account details are saved. Add an optional address to finish.'
            : 'Add your name and local service area to finish setting up your account.'
          : step === 'otp'
            ? 'Verify your phone number with the one-time code.'
            : mode === 'signup'
              ? 'Create an account with your mobile number.'
              : 'Welcome back. Sign in with your mobile number.'
      }>
        {step === 'profile' ? (mode === 'signup' ? 'Finish account setup' : 'Complete your profile') : mode === 'signup' ? 'Create account' : 'Sign in'}
      </Heading>
      {step === 'phone' ? (
        <>
          <Text style={commonStyles.muted}>
            {mode === 'signup'
              ? 'Enter your details. We will send a one-time code to verify your phone number.'
              : 'Enter the phone number linked to your account. We will send a one-time code.'}
          </Text>
          {mode === 'signup' ? (
            <>
              <Field accessibilityLabel="Full name" autoComplete="off" onChangeText={setName} placeholder="Full name" value={name} />
              <PostalAreaPicker
                pinCode={pinCode}
                onPinCodeChange={setPinCode}
              />
              <Field accessibilityLabel="Local area or place name" onChangeText={setLocation} placeholder="Local area / place name" value={location} />
              <Field accessibilityLabel="House, street, or landmark (optional)" autoComplete="street-address" onChangeText={setPinAddress} placeholder="House, street, or landmark (optional)" value={pinAddress} />
            </>
          ) : null}
          <Field
            accessibilityLabel="Phone number"
            autoComplete="tel"
            keyboardType="phone-pad"
            maxLength={14}
            onChangeText={setPhone}
            placeholder="10-digit phone number"
            value={phone}
          />
          <ActionButton title="Send verification code" loading={busy} onPress={sendOtp} />
          <Pressable
            accessibilityRole="button"
            onPress={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
            style={styles.modeSwitch}
          >
            <Text style={styles.modeSwitchText}>
              {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </Pressable>
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
          <Pressable
            accessibilityRole="button"
            onPress={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
            style={styles.modeSwitch}
          >
            <Text style={styles.modeSwitchText}>
              {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </Pressable>
        </>
      ) : null}
      {step === 'profile' ? (
        <>
          {mode === 'signin' ? (
            <>
              <Field accessibilityLabel="Full name" autoComplete="off" onChangeText={setName} placeholder="Full name" value={name} />
              <Field accessibilityLabel="Local area or place name" onChangeText={setLocation} placeholder="Local area / place name" value={location} />
              <PostalAreaPicker pinCode={pinCode} onPinCodeChange={setPinCode} />
              <Field accessibilityLabel="House, street, or landmark (optional)" autoComplete="street-address" onChangeText={setPinAddress} placeholder="House, street, or landmark (optional)" value={pinAddress} />
            </>
          ) : (
            <Text style={commonStyles.muted}>Your name, area, and PIN code are ready.</Text>
          )}
          <ActionButton title={mode === 'signup' ? 'Create account' : 'Save and continue'} loading={busy} onPress={completeProfile} />
        </>
      ) : null}
      {message ? <Notice error>{message}</Notice> : null}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { padding: 0 },
  content: { flexGrow: 1, gap: 16, justifyContent: 'center', padding: 20 },
  modeSwitch: { alignItems: 'center', padding: 12 },
  modeSwitchText: { color: '#FF6B35', fontSize: 14, fontWeight: '700' },
});
