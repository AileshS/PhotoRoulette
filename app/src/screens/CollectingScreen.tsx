import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import type { RoomState } from '../../../shared/protocol';
import { Avatar, Card, Screen, Txt } from '../components/ui';
import { colors, gradients } from '../theme';

const WHEEL = ['🌅', '🐱', '🎉', '🍔', '🏔️', '🤳', '🌮', '🎸'];

export function CollectingScreen({ room, sharing }: { room: RoomState; sharing: boolean }) {
  const players = room.players.filter((p) => p.connected);
  const ready = players.filter((p) => p.photosReady).length;

  return (
    <Screen gradient={gradients.collecting}>
      <View style={styles.center}>
        <Wheel />
        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={{ gap: 6 }}>
          <Txt size={32} weight="bold" center>
            Spinning the roulette…
          </Txt>
          <Txt size={16} center color={colors.muted}>
            {sharing ? 'Picking random photos from your camera roll 🤫' : 'Grabbing random photos from everyone'}
          </Txt>
        </Animated.View>
      </View>

      <Card style={{ gap: 10 }}>
        <Txt size={15} weight="semibold" color={colors.muted}>
          {ready}/{players.length} ready
        </Txt>
        {players.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(200 + i * 60)} style={styles.row}>
            <Avatar name={p.name} color={p.color} size={36} />
            <Txt size={18} weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
              {p.name}
            </Txt>
            {p.photosReady ? (
              <Animated.View entering={ZoomIn.duration(300)}>
                <Txt size={20}>✅</Txt>
              </Animated.View>
            ) : (
              <ActivityIndicator color={colors.white} />
            )}
          </Animated.View>
        ))}
      </Card>
    </Screen>
  );
}

function Wheel() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1));
    return () => cancelAnimation(spin);
  }, [spin]);
  const wheel = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const counter = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 360}deg` }] }));
  const R = 88;
  return (
    <Animated.View entering={ZoomIn.duration(300)} style={styles.wheelWrap}>
      <Animated.View style={[styles.wheel, wheel]}>
        {WHEEL.map((emoji, i) => {
          const a = (i / WHEEL.length) * Math.PI * 2;
          return (
            <Animated.View
              key={emoji}
              style={[styles.slot, { transform: [{ translateX: Math.cos(a) * R }, { translateY: Math.sin(a) * R }] }]}
            >
              <Animated.View style={counter}>
                <Txt size={30}>{emoji}</Txt>
              </Animated.View>
            </Animated.View>
          );
        })}
      </Animated.View>
      <View style={styles.hub}>
        <Txt size={44}>📸</Txt>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wheelWrap: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  wheel: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hub: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: colors.white,
  },
});
