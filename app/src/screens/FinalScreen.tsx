import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import type { RoomState } from '../../../shared/protocol';
import { Avatar, Button, haptic, Screen, Txt } from '../components/ui';
import { game } from '../game/client';
import { colors, gradients, radius } from '../theme';
import { ranked } from './LeaderboardScreen';

const PODIUM = [
  { place: 2, height: 110, color: '#C0C7FF', delay: 500 },
  { place: 1, height: 150, color: colors.yellow, delay: 900 },
  { place: 3, height: 80, color: '#FFB38A', delay: 200 },
];

export function FinalScreen({ room }: { room: RoomState }) {
  const rows = ranked(room);
  const winners = rows.filter((r) => r.rank === 1).map((r) => r.player);
  const iWon = winners.some((w) => w.id === room.you.id);
  const host = room.players.find((p) => p.isHost);

  useEffect(() => {
    haptic(iWon ? 'success' : 'tap');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen gradient={gradients.finished}>
      <Confetti />
      <Animated.View entering={FadeInDown.springify()} style={{ paddingTop: 8, gap: 2 }}>
        <Txt size={18} center color={colors.muted}>
          Game over!
        </Txt>
        <Txt size={36} weight="bold" center testID="winner">
          {iWon ? 'You win! 🎉' : winners.length > 1 ? "It's a tie! 🤝" : `${winners[0]?.name ?? 'Nobody'} wins! 🎉`}
        </Txt>
      </Animated.View>

      <View style={styles.podium}>
        {PODIUM.map(({ place, height, color, delay }) => {
          const entry = rows[place - 1];
          return (
            <View key={place} style={styles.podiumCol}>
              {entry && (
                <Animated.View
                  entering={ZoomIn.delay(delay + 350)
                    .springify()
                    .damping(8)}
                  style={{ alignItems: 'center', gap: 4 }}
                >
                  {place === 1 && <Txt size={28}>👑</Txt>}
                  <Avatar name={entry.player.name} color={entry.player.color} size={place === 1 ? 64 : 52} />
                  <Txt size={15} weight="bold" numberOfLines={1} style={{ maxWidth: 100 }}>
                    {entry.player.name}
                  </Txt>
                  <Txt size={14} color={colors.muted}>
                    {entry.player.score.toLocaleString()}
                  </Txt>
                </Animated.View>
              )}
              <Step height={entry ? height : 24} color={color} delay={delay} place={place} />
            </View>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {rows.slice(3).map(({ player: p, rank }, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(1300 + i * 80)} style={styles.row}>
            <Txt size={18} weight="bold" style={{ width: 28 }}>
              {rank}
            </Txt>
            <Avatar name={p.name} color={p.color} size={34} />
            <Txt size={17} weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
              {p.name}
            </Txt>
            <Txt size={17} weight="bold">
              {p.score.toLocaleString()}
            </Txt>
          </Animated.View>
        ))}
      </ScrollView>

      <Animated.View entering={FadeIn.delay(1500)} style={{ gap: 10 }}>
        {room.you.isHost ? (
          <Button testID="play-again" title="Play again" icon="🔁" onPress={() => game.playAgain()} />
        ) : (
          <Txt size={15} center color={colors.muted}>
            Waiting for {host?.name ?? 'the host'} to start another game…
          </Txt>
        )}
        <Pressable onPress={() => game.leaveRoom()} accessibilityRole="button" style={styles.leave}>
          <Txt size={16} weight="semibold" center>
            Leave room
          </Txt>
        </Pressable>
      </Animated.View>
    </Screen>
  );
}

function Step({ height, color, delay, place }: { height: number; color: string; delay: number; place: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.set(withDelay(delay, withSpring(height, { damping: 14, stiffness: 120 })));
  }, [h, height, delay]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View style={[styles.step, { backgroundColor: color }, style]}>
      <Txt size={28} weight="bold" color={colors.ink}>
        {place}
      </Txt>
    </Animated.View>
  );
}

const CONFETTI_COLORS = [colors.yellow, colors.cyan, colors.green, colors.white, '#FF7AF5', colors.orange];

function makeConfetti(width: number) {
  return Array.from({ length: 28 }, (_, i) => ({
    x: Math.random() * width,
    delay: Math.random() * 2500,
    duration: 2800 + Math.random() * 2200,
    size: 7 + Math.random() * 7,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
  }));
}

function Confetti() {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => makeConfetti(width), [width]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Piece key={i} {...p} fall={height + 40} />
      ))}
    </View>
  );
}

function Piece({
  x,
  delay,
  duration,
  size,
  color,
  spin,
  fall,
}: {
  x: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  spin: number;
  fall: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1)));
  }, [t, delay, duration]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x + Math.sin(t.value * Math.PI * 4) * 18 },
      { translateY: -30 + t.value * fall },
      { rotate: `${t.value * spin}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size * 0.5, backgroundColor: color, borderRadius: 2 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
    minHeight: 280,
  },
  podiumCol: { alignItems: 'center', justifyContent: 'flex-end', gap: 8, width: 100 },
  step: {
    width: 100,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    alignItems: 'center',
    paddingTop: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    padding: 10,
  },
  leave: { paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.glass },
});
