import React, { useMemo } from 'react';
import {
  useColorScheme,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const darkColors = {
  isDark: true,
  background: '#0D0D0D',
  surface: '#161616',
  card: '#1E1E1E',
  border: '#2A2A2A',
  accent: '#FF6B35',
  text: '#F0F0F0',
  muted: '#A0A0A0',
  success: '#22C55E',
  error: '#EF4444',
  hero: '#25160F',
  heroBorder: '#57301F',
  heroEyebrow: '#FFB18D',
  heroText: '#D2B6A8',
  iconSurface: '#30231E',
  selected: '#32190F',
  logoSurface: '#171717',
  backdrop: 'rgba(0,0,0,0.68)',
};

const lightColors: typeof darkColors = {
  isDark: false,
  background: '#F7F7F8',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#D9DCE1',
  accent: '#D94F1F',
  text: '#202124',
  muted: '#62666D',
  success: '#16803C',
  error: '#B42318',
  hero: '#FFF0E8',
  heroBorder: '#F2C6B1',
  heroEyebrow: '#A63D17',
  heroText: '#684336',
  iconSurface: '#FCE5D9',
  selected: '#FCE5D9',
  logoSurface: '#F0F0F1',
  backdrop: 'rgba(20,20,20,0.45)',
};

export function useColors() {
  const scheme = useColorScheme();
  return scheme === 'light' ? lightColors : darkColors;
}

export function useCommonStyles() {
  const colors = useColors();
  return useMemo(() => StyleSheet.create({
    card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: 16 },
    row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
    muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '700', marginBottom: 12 },
  }), [colors]);
}

/** Provide a scroll-safe screen base using the app's common background. */
export function Page({ children, style, ...props }: ViewProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createPageStyles(colors), [colors]);
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.safePage}>
      <View
        {...props}
        style={[
          styles.pageContent,
          style,
          { paddingBottom: Math.max(insets.bottom + 38, 48) },
        ]}
      >
        {children}
      </View>
      <View
        accessibilityRole="text"
        style={[styles.footer, { bottom: insets.bottom + 2 }]}
      >
        <Text style={styles.footerCredit}>Developed by <Text style={styles.footerName}>Ritik Soni</Text></Text>
        <Text style={styles.footerGroup}>Soni Groups</Text>
      </View>
    </SafeAreaView>
  );
}

/** Render a consistent screen title and optional supporting text. */
export function Heading({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  const colors = useColors();
  const styles = useMemo(() => createHeadingStyles(colors), [colors]);
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Style text fields consistently while preserving platform-native input behavior. */
export function Field(props: TextInputProps) {
  const colors = useColors();
  const styles = useMemo(() => createFieldStyles(colors), [colors]);
  const canClear = typeof props.value === 'string' && props.value.length > 0
    && typeof props.onChangeText === 'function' && props.editable !== false;
  return (
    <View style={[styles.fieldShell, props.multiline && styles.multilineShell]}>
      <View style={styles.fieldRow}>
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
        {canClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${props.accessibilityLabel ?? props.placeholder ?? 'input'}`}
            hitSlop={8}
            onPress={() => props.onChangeText?.('')}
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>
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
  const colors = useColors();
  const styles = useMemo(() => createButtonStyles(colors), [colors]);
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
        ? <ActivityIndicator color={secondary ? colors.text : '#FFFFFF'} />
        : <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>}
    </Pressable>
  );
}

/** Present inline feedback without opening blocking native dialogs. */
export function Notice({ children, error = false }: { children: string; error?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createNoticeStyles(colors), [colors]);
  return <Text accessibilityRole="alert" style={[styles.notice, error && styles.error]}>{children}</Text>;
}

function createPageStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safePage: { backgroundColor: colors.background, flex: 1 },
    pageContent: { backgroundColor: colors.background, flex: 1, gap: 16, padding: 20 },
    footer: { alignItems: 'center', backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: 1, left: 0, paddingHorizontal: 20, paddingTop: 4, position: 'absolute', right: 0 },
    footerCredit: { color: colors.muted, fontSize: 10 },
    footerName: { color: colors.accent, fontWeight: '700' },
    footerGroup: { color: colors.muted, fontSize: 9 },
  });
}

function createHeadingStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    heading: { gap: 6, marginBottom: 4 },
    title: { color: colors.text, fontSize: 28, fontWeight: '800' },
    subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  });
}

function createFieldStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    fieldShell: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 54, paddingHorizontal: 14, paddingVertical: 4 },
    multilineShell: { minHeight: 100, paddingVertical: 4 },
    fieldRow: { alignItems: 'center', flexDirection: 'row', minHeight: 42 },
    field: { backgroundColor: 'transparent', borderWidth: 0, color: colors.text, flex: 1, fontSize: 16, minHeight: 42, padding: 0 },
    multiline: { minHeight: 90, textAlignVertical: 'top' },
    clearButton: { alignItems: 'center', height: 32, justifyContent: 'center', marginLeft: 8, width: 32 },
    clearText: { color: colors.muted, fontSize: 25, fontWeight: '400', lineHeight: 28 },
  });
}

function createButtonStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    button: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 12, justifyContent: 'center', minHeight: 52, paddingHorizontal: 16 },
    secondaryButton: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
    disabledButton: { opacity: 0.55 },
    pressed: { opacity: 0.8 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    secondaryButtonText: { color: colors.text },
  });
}

function createNoticeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    notice: { color: colors.success, fontSize: 14, lineHeight: 20 },
    error: { color: colors.error },
  });
}
