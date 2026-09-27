import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import type { PublicPlayer, RoomState } from '../../../shared/protocol';
import { AnimatedNumber, Avatar, Screen, Txt } from '../components/ui';
import { colors, fonts, gradients, radius } from '../theme';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Players in this game, ranked. Ties share a rank. */
export function ranked(room: RoomState, scoreOf: (p: PublicPlayer) => number = (p) => p.score) {
  const inGame = new Set(room.round?.choices.map((c) => c.id) ?? room.players.map((p) => p.id));
  const sorted = room.players
    .filter((p) => inGame.has(p.id))
    .sort((a, b) => scoreOf(b) - scoreOf(a) || a.name.localeCompare(b.name));
  return sorted.map((p, i) => ({
    player: p,
    rank: sorted.findIndex((q) => scoreOf(q) === scoreOf(p)) + 1,
    index: i,
  }));
}

export function LeaderboardScreen({ room }: { room: RoomState }) {
  const round = room.round!;
  // Show last round's standings first, then let the new scores re-sort the list.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, []);
  const scoreOf = (p: PublicPlayer) => (settled ? p.score : p.score - p.lastGain);
  const rows = ranked(room, scoreOf);
  const remaining = round.total - round.index - 1;

  return (
    <Screen gradient={gradients.leaderboard}>
      <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
        <Txt size={40} weight="bold" center>
          🏆 Leaderboard
        </Txt>
        <Txt size={16} center color={colors.muted}>
          {remaining === 1 ? 'One round left!' : `${remaining} rounds to go`}
        </Txt>
      </Animated.View>

      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {rows.map(({ player: p, rank, index }) => {
          const you = p.id === room.you.id;
          return (
            <Animated.View
              key={p.id}
              entering={FadeInDown.delay(100 + index * 70).duration(300)}
              layout={LinearTransition.duration(300)}
              style={[styles.row, you && styles.you, !p.connected && { opacity: 0.55 }]}
            >
              <View style={styles.rank}>
                {rank <= 3 ? (
                  <Txt size={28}>{MEDALS[rank - 1]}</Txt>
                ) : (
                  <Txt size={20} weight="bold">
                    {rank}
                  </Txt>
                )}
              </View>
              <Avatar name={p.name} color={p.color} size={44} />
              <View style={{ flex: 1 }}>
                <Txt size={19} weight="semibold" numberOfLines={1}>
                  {p.name}
                </Txt>
                {you && (
                  <Txt size={12} weight="semibold" color={colors.yellow}>
                    YOU
                  </Txt>
                )}
              </View>
              {p.lastGain > 0 && (
                <Animated.View entering={ZoomIn.delay(400 + index * 70).duration(300)} style={styles.gain}>
                  <Txt size={14} weight="bold" color={colors.ink}>
                    +{p.lastGain}
                  </Txt>
                </Animated.View>
              )}
              <AnimatedNumber value={scoreOf(p)} style={styles.score} />
            </Animated.View>
          );
        })}
      </ScrollView>

      <Txt size={15} center color={colors.muted}>
        Next photo coming up…
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: 16, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  you: { borderColor: colors.yellow, backgroundColor: colors.glassStrong },
  rank: { width: 34, alignItems: 'center' },
  gain: { backgroundColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  score: { fontFamily: fonts.bold, fontSize: 22, color: colors.white, minWidth: 64, textAlign: 'right' },
});
