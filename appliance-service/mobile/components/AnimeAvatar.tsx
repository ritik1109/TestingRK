import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const palettes = [
  { backdrop: '#382A59', hair: '#29213C', skin: '#F3C5A5', eyes: '#6ED6E7', accent: '#FF9C74' },
  { backdrop: '#264D55', hair: '#34251F', skin: '#D99C78', eyes: '#88E0B0', accent: '#FFCB75' },
  { backdrop: '#59403D', hair: '#382638', skin: '#F2C9B0', eyes: '#9DB6FF', accent: '#FF8EAE' },
  { backdrop: '#33405D', hair: '#1F2635', skin: '#C98B68', eyes: '#E6C66D', accent: '#90D9D2' },
];

/** Render a small, locally drawn anime-inspired avatar without remote images. */
export function AnimeAvatar({ name, size = 76 }: { name: string; size?: number }) {
  const palette = useMemo(() => {
    const hash = [...name].reduce((value, character) => value + character.charCodeAt(0), 0);
    return palettes[hash % palettes.length];
  }, [name]);
  const scale = size / 172;

  return (
    <View accessibilityLabel="Illustrated manga-style anime profile avatar" style={[styles.frame, { width: size, height: size }]}>
      <View style={[styles.art, { left: (size - 172) / 2, top: (size - 172) / 2, transform: [{ scale }] }]}>
        <View style={[styles.backdrop, { backgroundColor: palette.backdrop }]}>
          <View style={[styles.hairBack, { backgroundColor: palette.hair }]} />
          <View style={[styles.face, { backgroundColor: palette.skin }]}>
            <View style={[styles.fringe, { backgroundColor: palette.hair }]} />
            <View style={[styles.fringePoint, { backgroundColor: palette.hair }]} />
            <View style={styles.eyes}>
              <View style={styles.eye}><View style={[styles.iris, { backgroundColor: palette.eyes }]} /><View style={styles.glint} /></View>
              <View style={styles.eye}><View style={[styles.iris, { backgroundColor: palette.eyes }]} /><View style={styles.glint} /></View>
            </View>
            <View style={styles.browLeft} />
            <View style={styles.browRight} />
            <View style={styles.blushRow}>
              <View style={[styles.blush, { backgroundColor: palette.accent }]} />
              <View style={[styles.blush, { backgroundColor: palette.accent }]} />
            </View>
            <View style={styles.mouth} />
          </View>
          <View style={[styles.hairLockLeft, { backgroundColor: palette.hair }]} />
          <View style={[styles.hairLockRight, { backgroundColor: palette.hair }]} />
          <View style={[styles.shirt, { backgroundColor: palette.accent }]} />
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.sparkleSmall}>✧</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  art: { height: 172, position: 'absolute', width: 172 },
  backdrop: {
    alignItems: 'center',
    borderColor: '#F0F0F0',
    borderRadius: 90,
    borderWidth: 3,
    height: 172,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 172,
  },
  hairBack: { borderRadius: 58, height: 126, position: 'absolute', top: 13, width: 112 },
  face: { borderColor: '#211B24', borderRadius: 34, borderWidth: 1.5, height: 94, overflow: 'hidden', position: 'absolute', top: 37, width: 78 },
  fringe: { borderBottomLeftRadius: 23, borderBottomRightRadius: 13, height: 34, left: -3, position: 'absolute', top: -7, transform: [{ rotate: '-5deg' }], width: 82 },
  fringePoint: { height: 0, left: 31, position: 'absolute', top: 21, transform: [{ rotate: '18deg' }], width: 0, borderLeftColor: 'transparent', borderLeftWidth: 12, borderRightColor: 'transparent', borderRightWidth: 4, borderTopColor: '#211B24', borderTopWidth: 24 },
  eyes: { flexDirection: 'row', gap: 16, left: 13, position: 'absolute', top: 39 },
  eye: { alignItems: 'center', backgroundColor: '#FFF8F2', borderColor: '#211B24', borderRadius: 6, borderWidth: 1, height: 19, justifyContent: 'center', overflow: 'hidden', transform: [{ rotate: '-5deg' }], width: 13 },
  iris: { borderRadius: 6, height: 12, marginTop: 4, width: 9 },
  glint: { backgroundColor: '#FFFFFF', borderRadius: 2, height: 3, left: 2, position: 'absolute', top: 5, width: 3 },
  browLeft: { backgroundColor: '#211B24', height: 2, left: 12, position: 'absolute', top: 35, transform: [{ rotate: '-12deg' }], width: 16 },
  browRight: { backgroundColor: '#211B24', height: 2, position: 'absolute', right: 12, top: 35, transform: [{ rotate: '12deg' }], width: 16 },
  blushRow: { flexDirection: 'row', justifyContent: 'space-between', left: 7, position: 'absolute', top: 62, width: 64 },
  blush: { borderRadius: 8, height: 4, opacity: 0.55, width: 13 },
  mouth: { backgroundColor: '#A84F59', borderBottomLeftRadius: 6, borderBottomRightRadius: 6, height: 4, left: 36, position: 'absolute', top: 70, width: 7 },
  hairLockLeft: { borderBottomLeftRadius: 18, borderBottomRightRadius: 15, height: 54, left: 29, position: 'absolute', top: 51, transform: [{ rotate: '9deg' }], width: 15 },
  hairLockRight: { borderBottomLeftRadius: 16, borderBottomRightRadius: 18, height: 50, position: 'absolute', right: 28, top: 52, transform: [{ rotate: '-10deg' }], width: 15 },
  shirt: { borderTopLeftRadius: 42, borderTopRightRadius: 42, bottom: -24, height: 56, position: 'absolute', width: 104 },
  sparkle: { color: '#FFF0B5', fontSize: 19, position: 'absolute', right: 25, top: 29 },
  sparkleSmall: { color: '#FFF0B5', fontSize: 14, left: 24, position: 'absolute', top: 52 },
});
