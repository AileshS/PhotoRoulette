import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated';
import type { RoomState } from '../../../shared/protocol';
import { Avatar, Button, Card, haptic, Pill, Screen, Txt } from '../components/ui';
import { game } from '../game/client';
import { colors, gradients, radius } from '../theme';

const PRESETS = [5, 10, 15, 20];
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 30;

export function LobbyScreen({ room }: { room: RoomState }) {
  const isHost = room.you.isHost;
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local copy so the stepper feels instant; only the host ever changes it.
  const [pending, setPending] = useState<number | null>(null);
  const rounds = pending ?? room.settings.rounds;

  const connected = room.players.filter((p) => p.connected);
  const canStart = connected.length >= 2;
  const host = room.players.find((p) => p.isHost);

  const changeRounds = (n: number) => {
    const next = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, n));
    if (next === rounds) return;
    haptic();
    setPending(next);
    game.setRounds(next);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(room.code);
    haptic('success');
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const start = async () => {
    setStarting(true);
    setError(null);
    const res = await game.startGame();
    setStarting(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <Screen gradient={gradients.lobby}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => game.leaveRoom()}
          accessibilityRole="button"
          accessibilityLabel="Leave room"
          style={styles.leave}
        >
          <Txt size={15} weight="semibold">
            ✕ Leave
          </Txt>
        </Pressable>
        <Pill>
          <Txt size={14} weight="semibold">
            {connected.length} player{connected.length === 1 ? '' : 's'}
          </Txt>
        </Pill>
      </View>

      <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', gap: 8 }}>
          <Txt size={16} color={colors.muted}>
            Room code
          </Txt>
          <Pressable
            onPress={copy}
            accessibilityRole="button"
            accessibilityLabel={`Room code ${room.code}, tap to copy`}
          >
            <View style={styles.codeRow} testID="room-code">
              {room.code.split('').map((ch, i) => (
                <Animated.View key={i} entering={ZoomIn.delay(120 + i * 80).duration(300)} style={styles.codeTile}>
                  <Txt size={44} weight="bold" color={colors.ink}>
                    {ch}
                  </Txt>
                </Animated.View>
              ))}
            </View>
          </Pressable>
          <Txt size={14} color={copied ? colors.green : colors.muted}>
            {copied ? '✓ Copied!' : 'Tap to copy · share it with your friends'}
          </Txt>
        </Animated.View>

        {room.notice && (
          <Animated.View entering={FadeIn} style={styles.notice}>
            <Txt size={15} center>
              {room.notice}
            </Txt>
          </Animated.View>
        )}

        <Card style={{ gap: 12 }}>
          <Txt size={20} weight="bold">
            {"Who's here"}
          </Txt>
          <View style={styles.players}>
            {room.players.map((p) => (
              <Animated.View
                key={p.id}
                entering={ZoomIn.duration(300)}
                exiting={ZoomOut.duration(200)}
                layout={LinearTransition.duration(300)}
                style={[styles.player, !p.connected && { opacity: 0.45 }]}
              >
                <View>
                  <Avatar name={p.name} color={p.color} size={56} />
                  {p.isHost && <Txt style={styles.crown}>👑</Txt>}
                </View>
                <Txt size={15} weight="semibold" numberOfLines={1} style={{ maxWidth: 84 }}>
                  {p.name}
                </Txt>
                {p.id === room.you.id && (
                  <Txt size={12} color={colors.yellow}>
                    you
                  </Txt>
                )}
              </Animated.View>
            ))}
            {room.players.length < 3 && (
              <Animated.View
                entering={FadeIn.delay(400)}
                exiting={FadeOut}
                layout={LinearTransition}
                style={styles.player}
              >
                <View style={styles.emptySeat}>
                  <Txt size={24} color={colors.faint}>
                    ?
                  </Txt>
                </View>
                <Txt size={13} color={colors.faint}>
                  waiting…
                </Txt>
              </Animated.View>
            )}
          </View>
        </Card>

        {isHost ? (
          <Card style={{ gap: 14 }}>
            <Txt size={20} weight="bold">
              How many rounds?
            </Txt>
            <View style={styles.stepper}>
              <StepButton label="−" onPress={() => changeRounds(rounds - 1)} disabled={rounds <= MIN_ROUNDS} />
              <Animated.View key={rounds} entering={ZoomIn.duration(300)} style={{ minWidth: 90 }}>
                <Txt size={52} weight="bold" center testID="rounds-value">
                  {rounds}
                </Txt>
              </Animated.View>
              <StepButton label="+" onPress={() => changeRounds(rounds + 1)} disabled={rounds >= MAX_ROUNDS} />
            </View>
            <View style={styles.presets}>
              {PRESETS.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => changeRounds(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} rounds`}
                  style={[styles.preset, rounds === n && styles.presetActive]}
                >
                  <Txt size={16} weight="bold" color={rounds === n ? colors.ink : colors.white}>
                    {n}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', gap: 6 }}>
            <Txt size={40}>⏳</Txt>
            <Txt size={18} weight="semibold" center>
              Waiting for {host?.name ?? 'the host'} to start
            </Txt>
            <Txt size={15} color={colors.muted}>
              {room.settings.rounds} round{room.settings.rounds === 1 ? '' : 's'}
            </Txt>
          </Card>
        )}
      </ScrollView>

      {isHost && (
        <View style={{ gap: 8 }}>
          {error && (
            <Txt size={14} center color={colors.yellow}>
              {error}
            </Txt>
          )}
          <Button
            testID="start-game"
            title={canStart ? 'Start game' : 'Need 2+ players'}
            icon={canStart ? '▶️' : '👥'}
            disabled={!canStart}
            loading={starting}
            onPress={start}
          />
        </View>
      )}
    </Screen>
  );
}

function StepButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'More rounds' : 'Fewer rounds'}
      style={[styles.step, disabled && { opacity: 0.35 }]}
    >
      <Txt size={32} weight="bold" color={colors.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  leave: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.glass },
  codeRow: { flexDirection: 'row', gap: 10 },
  codeTile: {
    width: 64,
    height: 78,
    borderRadius: radius.md,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  notice: { backgroundColor: 'rgba(255,77,109,0.8)', borderRadius: radius.md, padding: 12 },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  player: { alignItems: 'center', gap: 4, width: 84 },
  crown: { position: 'absolute', top: -14, right: -6, fontSize: 22 },
  emptySeat: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  step: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presets: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  preset: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  presetActive: { backgroundColor: colors.yellow, borderColor: colors.yellow },
});
