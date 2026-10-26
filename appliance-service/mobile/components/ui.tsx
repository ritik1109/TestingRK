import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

export const colors = {
  background: '#0D0D0D',
  surface: '#161616',
  card: '#1E1E1E',
  border: '#2A2A2A',
  accent: '#FF6B35',
  text: '#F0F0F0',
  muted: '#A0A0A0',
  success: '#22C55E',
  error: '#EF4444',
};

/** Provide a scroll-safe screen base using the app's common background. */
export function Page({ children, style, ...props }: ViewProps) {
  return <View {...props} style={[styles.page, style]}>{children}</View>;
}

/** Render a consistent screen title and optional supporting text. */
export function Heading({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Style text fields consistently while preserving platform-native input behavior. */
export function Field(props: TextInputProps) {
  return (
    <View style={[styles.fieldShell, props.multiline && styles.multilineShell]}>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        underlineColorAndroid="transparent"
        {...props}
        autoComplete="off"
        textContentType="none"
        style={[styles.field, props.multiline && styles.multiline, props.style]}
        importantForAutofill="no"
      />
    </View>
  );
}

/** Provide a large accessible action control with busy and disabled states. */
export function ActionButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (disabled || loading) && styles.disabledButton,
        pressed && styles.pressed,
      ]}
    >
      {loading
        ? <ActivityIndicator color={colors.text} />
        : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

/** Present inline feedback without opening blocking native dialogs. */
export function Notice({ children, error = false }: { children: string; error?: boolean }) {
  return <Text accessibilityRole="alert" style={[styles.notice, error && styles.error]}>{children}</Text>;
}

export const commonStyles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: 16 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '700', marginBottom: 12 },
});

const styles = StyleSheet.create({
  page: { backgroundColor: colors.background, flex: 1, gap: 16, padding: 20 },
  heading: { gap: 6, marginBottom: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  fieldShell: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 54, paddingHorizontal: 14, paddingVertical: 4 },
  multilineShell: { minHeight: 100, paddingVertical: 4 },
  field: { backgroundColor: 'transparent', borderWidth: 0, color: colors.text, fontSize: 16, minHeight: 42, padding: 0 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  button: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 12, justifyContent: 'center', minHeight: 52, paddingHorizontal: 16 },
  secondaryButton: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
  disabledButton: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  notice: { color: colors.success, fontSize: 14, lineHeight: 20 },
  error: { color: colors.error },
});
