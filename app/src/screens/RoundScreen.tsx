import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import type { RoomState } from '../../../shared/protocol';
import { Avatar, haptic, Pill, Screen, Txt } from '../components/ui';
import { photoUrl } from '../config';
import { game } from '../game/client';
import { colors, gradients, radius } from '../theme';

/** If the photo is slow to load, start the clock anyway after this long. */
const LOAD_FALLBACK_MS = 1500;

export function RoundScreen({ room, clockOffset }: { room: RoomState; clockOffset: number }) {
  const round = room.round!;
  const revealed = room.phase === 'reveal';

  const [localGuess, setMyGuess] = useState<string | null>(null);
  // After a reconnect the server remembers our answer even if we don't.
  const myGuess = localGuess ?? room.you.guessId;
  const [timeUp, setTimeUp] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(round.answerMs / 1000));
  const clock = useRef<{ shownAt: number; budget: number } | null>(null);
  const progress = useSharedValue(1);

  const startClock = () => {
    if (clock.current || revealed) return;
    const serverNow = Date.now() + clockOffset;
    const budget = Math.max(0, Math.min(round.answerMs, round.deadline - serverNow));
    clock.current = { shownAt: Date.now(), budget };
    progress.set(budget / round.answerMs);
    progress.set(withTiming(0, { duration: budget, easing: Easing.linear }));
  };

  // Fallback in case onLoad never fires (slow network / broken image).
  useEffect(() => {
    const t = setTimeout(startClock, LOAD_FALLBACK_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (revealed) {
      cancelAnimation(progress);
      return;
    }
    const id = setInterval(() => {
      const c = clock.current;
      if (!c) return;
      const left = c.budget - (Date.now() - c.shownAt);
      setSecondsLeft(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        setTimeUp(true);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [revealed, progress]);

  const locked = revealed || timeUp || myGuess !== null;

  const choose = async (id: string) => {
    if (locked || !clock.current) return;
    const elapsed = elapsedMs(clock.current, round.answerMs);
    setMyGuess(id);
    haptic();
    const res = await game.answer(round.index, id, elapsed);
    if (!res.ok && !revealed) {
      setMyGuess(null);
      setTimeUp(true);
    }
  };

  const trackOpacity = useSharedValue(1);
  useEffect(() => {
    if (revealed) trackOpacity.set(withTiming(0, { duration: 300 }));
  }, [revealed, trackOpacity]);
  const trackStyle = useAnimatedStyle(() => ({ opacity: trackOpacity.value }));

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.3, 0.6, 1],
      [colors.red, colors.orange, colors.yellow, colors.green],
    ),
  }));

  const uri = photoUrl(round.photoUrl);
  const owner = round.choices.find((c) => c.id === round.ownerId);
  const layout = gridFor(round.choices.length);
  const answeredCount = round.answeredIds.length;
  const canAnswerCount = round.choices.filter((c) => room.players.find((p) => p.id === c.id)?.connected).length;

  return (
    <Screen gradient={gradients.round}>
      <View style={styles.header}>
        <Pill>
          <Txt size={15} weight="bold">
            Round {round.index + 1}/{round.total}
          </Txt>
        </Pill>
        {!revealed && (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Pill color={secondsLeft <= 2 ? colors.red : colors.glassStrong}>
              <Txt size={15} weight="bold" testID="seconds-left">
                ⏱ {secondsLeft}s
              </Txt>
            </Pill>
          </Animated.View>
        )}
        <Pill>
          <Txt size={15} weight="semibold">
            🔒 {answeredCount}/{Math.max(canAnswerCount, answeredCount)}
          </Txt>
        </Pill>
      </View>

      <Animated.View style={[styles.barTrack, trackStyle]}>
        <Animated.View style={[styles.bar, barStyle]} />
      </Animated.View>

      <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.photoCard}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} blurRadius={24} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
        <Image
          testID="round-photo"
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          onLoad={startClock}
          onError={startClock}
        />
        {revealed && owner && (
          <Animated.View
            entering={FadeInUp.springify().damping(12)}
            style={[styles.photoBanner, { backgroundColor: owner.color }]}
          >
            <Txt size={20} weight="bold" center color={colors.ink}>
              📸 {owner.id === room.you.id ? 'Your' : `${owner.name}'s`} photo!
            </Txt>
          </Animated.View>
        )}
      </Animated.View>

      <View style={styles.prompt}>
        {revealed ? (
          <RevealResult room={room} />
        ) : (
          <Txt size={22} weight="bold" center>
            {myGuess ? 'Locked in! 🔒' : timeUp ? "⏰ Time's up!" : 'Whose photo is this?'}
          </Txt>
        )}
      </View>

      <View style={styles.choices}>
        {round.choices.map((c, i) => {
          const guessers = revealed
            ? Object.entries(round.guesses ?? {})
                .filter(([, g]) => g.guessId === c.id)
                .map(([pid]) => room.players.find((p) => p.id === pid))
                .filter((p) => !!p)
            : [];
          return (
            <Choice
              key={c.id}
              index={i}
              name={c.id === room.you.id ? `${c.name} (you)` : c.name}
              color={c.color}
              selected={myGuess === c.id}
              dimmed={revealed ? c.id !== round.ownerId && myGuess !== c.id : locked && myGuess !== c.id}
              state={revealed ? (c.id === round.ownerId ? 'owner' : myGuess === c.id ? 'wrong' : 'none') : 'none'}
              disabled={locked}
              guessers={guessers.map((p) => ({ name: p.name, color: p.color }))}
              layout={layout}
              onPress={() => void choose(c.id)}
            />
          );
        })}
      </View>
    </Screen>
  );
}

/** How long this player has been looking at the photo, as seen by the server's clock budget. */
function elapsedMs(clock: { shownAt: number; budget: number }, answerMs: number): number {
  return answerMs - clock.budget + (Date.now() - clock.shownAt);
}

interface GridLayout {
  width: `${number}%`;
  height: number;
  font: number;
  showGuessers: boolean;
}

/** Keeps every name on screen, from a 2-player game up to a full room. */
function gridFor(count: number): GridLayout {
  if (count <= 6) return { width: '48%', height: 56, font: 18, showGuessers: true };
  if (count <= 12) return { width: '31.5%', height: 48, font: 15, showGuessers: count <= 9 };
  return { width: '23%', height: 42, font: 13, showGuessers: false };
}

function RevealResult({ room }: { room: RoomState }) {
  const round = room.round!;
  const owner = round.choices.find((c) => c.id === round.ownerId);
  const mine = round.guesses?.[room.you.id];
  const yours = room.you.ownsCurrentPhoto;
  const whose = yours ? 'It was your own photo! 🙈' : `It was ${owner?.name ?? 'someone else'}'s`;

  let gradient: readonly [string, string, ...string[]];
  let title: string;
  let subtitle: string;
  if (mine?.correct) {
    gradient = gradients.success;
    title = `✅ Correct! +${mine.points}`;
    subtitle = yours
      ? `You know your own camera roll · ${(mine.ms / 1000).toFixed(1)}s`
      : `${(mine.ms / 1000).toFixed(1)}s — ${mine.points >= 450 ? 'lightning fast ⚡' : 'nice one'}`;
  } else if (mine) {
    gradient = gradients.danger;
    title = '❌ Nope!';
    subtitle = whose;
  } else {
    gradient = gradients.primary;
    title = '⏰ Too slow!';
    subtitle = whose;
  }
  const dark = gradient === gradients.primary;

  useEffect(() => {
    haptic(mine?.correct ? 'success' : 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View entering={ZoomIn.springify().damping(10)} testID="reveal-result">
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.result}>
        <Txt size={24} weight="bold" center color={dark ? colors.ink : colors.white}>
          {title}
        </Txt>
        <Txt size={15} center color={dark ? colors.ink : colors.white} style={{ opacity: 0.85 }}>
          {subtitle}
        </Txt>
      </LinearGradient>
    </Animated.View>
  );
}

function Choice({
  index,
  name,
  color,
  selected,
  dimmed,
  state,
  disabled,
  guessers,
  layout,
  onPress,
}: {
  layout: GridLayout;
  index: number;
  name: string;
  color: string;
  selected: boolean;
  dimmed: boolean;
  state: 'owner' | 'wrong' | 'none';
  disabled: boolean;
  guessers: { name: string; color: string }[];
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    scale.set(withSpring(selected || state === 'owner' ? 1.04 : dimmed ? 0.96 : 1, { damping: 12 }));
    opacity.set(withTiming(dimmed ? 0.4 : 1, { duration: 250 }));
  }, [selected, dimmed, state, scale, opacity]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const border =
    state === 'owner' ? colors.green : state === 'wrong' ? colors.red : selected ? colors.white : 'transparent';

  return (
    <Animated.View
      entering={FadeInDown.delay(150 + index * 50).springify()}
      style={[{ width: layout.width }, animated]}
    >
      <Animated.View style={fade}>
        <Pressable
          testID={`choice-${name}`}
          accessibilityRole="button"
          accessibilityLabel={name}
          disabled={disabled}
          onPressIn={() => !disabled && scale.set(withSpring(0.94))}
          onPressOut={() => !disabled && scale.set(withSpring(1))}
          onPress={onPress}
          style={[styles.choice, { height: layout.height, backgroundColor: color, borderColor: border }]}
        >
          <Txt size={layout.font} weight="bold" color={colors.ink} numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Txt>
          {state === 'owner' && (
            <Animated.View entering={ZoomIn.springify()} style={[styles.badge, { backgroundColor: colors.green }]}>
              <Txt size={14}>✓</Txt>
            </Animated.View>
          )}
          {state === 'wrong' && (
            <Animated.View entering={ZoomIn.springify()} style={[styles.badge, { backgroundColor: colors.red }]}>
              <Txt size={14}>✕</Txt>
            </Animated.View>
          )}
          {selected && state === 'none' && (
            <Animated.View entering={ZoomIn.springify()} style={[styles.badge, { backgroundColor: colors.ink }]}>
              <Txt size={12}>🔒</Txt>
            </Animated.View>
          )}
        </Pressable>
      </Animated.View>
      {layout.showGuessers && guessers.length > 0 && (
        <View style={styles.guessers}>
          {guessers.map((g, i) => (
            <Animated.View
              key={g.name}
              entering={ZoomIn.delay(250 + i * 80).springify()}
              style={{ marginLeft: i ? -6 : 0 }}
            >
              <Avatar name={g.name} color={g.color} size={22} />
            </Animated.View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 12,
  },
  bar: { height: '100%', borderRadius: 5 },
  photoCard: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#12062B',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    minHeight: 200,
  },
  photoBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: colors.yellow,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  prompt: { minHeight: 70, justifyContent: 'center', marginVertical: 10 },
  result: { borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 16 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  choice: {
    borderRadius: radius.md,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
  },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  guessers: { flexDirection: 'row', justifyContent: 'center', marginTop: 4, height: 22 },
});
