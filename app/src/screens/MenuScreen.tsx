import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic, Screen, Shake, Txt } from '../components/ui';
import { game } from '../game/client';
import { colors, gradients, radius } from '../theme';

export function MenuScreen({
  name,
  notice,
  onJoin,
  onEditName,
}: {
  name: string;
  notice: string | null;
  onJoin: () => void;
  onEditName: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(notice);

  const create = async () => {
    setCreating(true);
    setError(null);
    const res = await game.createRoom();
    setCreating(false);
    if (!res.ok) {
      haptic('error');
      setError(res.error);
    }
  };

  return (
    <Screen gradient={gradients.menu}>
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <Txt size={18} color={colors.muted}>
          Hey there,
        </Txt>
        <Pressable onPress={onEditName} accessibilityRole="button" accessibilityLabel="Change name">
          <Txt size={40} weight="bold">
            {name} <Txt size={22}>✏️</Txt>
          </Txt>
        </Pressable>
      </Animated.View>

      <View style={styles.tiles}>
        <Tile
          testID="create-game"
          delay={100}
          gradient={gradients.primary}
          emoji="🎲"
          title="Create game"
          subtitle="Get a room code and invite your friends"
          dark
          loading={creating}
          onPress={create}
        />
        <Tile
          testID="join-game"
          delay={200}
          gradient={gradients.secondary}
          emoji="🔑"
          title="Join game"
          subtitle="Got a code from a friend? Hop in"
          onPress={onJoin}
        />
      </View>

      {error && (
        <Animated.View entering={FadeIn}>
          <Shake trigger={error}>
            <View style={styles.error}>
              <Txt size={15} center>
                {error}
              </Txt>
            </View>
          </Shake>
        </Animated.View>
      )}
    </Screen>
  );
}

function Tile({
  gradient,
  emoji,
  title,
  subtitle,
  dark,
  delay,
  loading,
  onPress,
  testID,
}: {
  gradient: readonly [string, string, ...string[]];
  emoji: string;
  title: string;
  subtitle: string;
  dark?: boolean;
  delay: number;
  loading?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const text = dark ? colors.ink : colors.white;
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={[{ flex: 1, maxHeight: 250 }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={loading}
        style={{ flex: 1 }}
        onPressIn={() => scale.set(withSpring(0.96))}
        onPressOut={() => scale.set(withSpring(1))}
        onPress={() => {
          haptic();
          onPress();
        }}
      >
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
          <Txt size={64}>{loading ? '⏳' : emoji}</Txt>
          <View>
            <Txt size={30} weight="bold" color={text}>
              {loading ? 'Creating…' : title}
            </Txt>
            <Txt size={16} color={text} style={{ opacity: 0.8 }}>
              {subtitle}
            </Txt>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 20 },
  tiles: { flex: 1, gap: 16, paddingBottom: 12, justifyContent: 'center' },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: 22,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  error: { backgroundColor: 'rgba(255,77,109,0.85)', borderRadius: radius.md, padding: 12, marginBottom: 4 },
});
