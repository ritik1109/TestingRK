import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/components/ui';

/** Show the RR Service brand mark consistently across app screens. */
export function BrandLogo({ centered = false }: { centered?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => StyleSheet.create({
    container: { alignItems: 'center', flexDirection: 'row', gap: 9 },
    centered: { alignSelf: 'center', flexDirection: 'column', gap: 8 },
    mark: { alignItems: 'center', backgroundColor: colors.logoSurface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', height: 38, justifyContent: 'center', width: 48 },
    markCentered: { borderRadius: 12, height: 64, width: 80 },
    letter: { color: colors.text, fontSize: 23, fontWeight: '800' },
    letterCentered: { fontSize: 38 },
    accentLetter: { color: colors.accent, fontSize: 23, fontWeight: '800', marginLeft: -2 },
    accentLetterCentered: { fontSize: 38 },
    name: { color: colors.text, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  }), [colors]);

  return (
    <View accessibilityLabel="RR Service" style={[styles.container, centered && styles.centered]}>
      <View style={[styles.mark, centered && styles.markCentered]}>
        <Text style={[styles.letter, centered && styles.letterCentered]}>R</Text>
        <Text style={[styles.accentLetter, centered && styles.accentLetterCentered]}>R</Text>
      </View>
      <Text style={styles.name}>RR SERVICE</Text>
    </View>
  );
}
