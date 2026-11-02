import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Field, Notice, useColors } from '@/components/ui';
import { apiRequest, type PostalAreaResponse } from '@/lib/api';

/** Silently validate an Indian postal PIN code as the customer enters it. */
export function PostalAreaPicker({
  pinCode,
  onPinCodeChange,
}: {
  pinCode: string;
  onPinCodeChange: (value: string) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => StyleSheet.create({
    container: { gap: 12 },
    validPin: { color: colors.success },
  }), [colors]);
  const [message, setMessage] = useState('');
  const [verifiedPin, setVerifiedPin] = useState('');

  useEffect(() => {
    const normalizedPin = pinCode.trim();
    if (!/^[1-9]\d{5}$/.test(normalizedPin)) {
      setVerifiedPin('');
      if (normalizedPin.length === 6) setMessage('Enter the correct 6-digit PIN code.');
      return undefined;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      setMessage('');
      try {
        await apiRequest<PostalAreaResponse>(
          `/location/pincode/${encodeURIComponent(normalizedPin)}`,
          { skipRefresh: true },
        );
        if (!active) return;
        setVerifiedPin(normalizedPin);
        setMessage('');
      } catch (error) {
        if (!active) return;
        setVerifiedPin('');
        setMessage(error instanceof Error && error.message.includes('not found')
          ? 'PIN code not found. Please enter the correct PIN code.'
          : 'Could not check the PIN code right now. Please try again.');
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [pinCode]);

  function changePinCode(value: string) {
    onPinCodeChange(value.replace(/\D/g, '').slice(0, 6));
    setVerifiedPin('');
    setMessage('');
  }

  return (
    <View style={styles.container}>
      <Field
        accessibilityLabel="Six-digit postal PIN code"
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={changePinCode}
        placeholder="6-digit PIN code"
        style={verifiedPin === pinCode.trim() ? styles.validPin : undefined}
        value={pinCode}
      />
      {message ? (
        <View accessibilityLiveRegion="polite">
          <Notice error>{message}</Notice>
        </View>
      ) : null}
    </View>
  );
}
