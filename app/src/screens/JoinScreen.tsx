import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Button, haptic, Screen, Shake, Txt } from '../components/ui';
import { game } from '../game/client';
import { colors, fonts, gradients, radius } from '../theme';

const CODE_LENGTH = 4;

export function JoinScreen({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  const join = async (value = code) => {
    if (value.length !== CODE_LENGTH || joining) return;
    setJoining(true);
    setError(null);
    const res = await game.joinRoom(value);
    setJoining(false);
    if (!res.ok) {
      haptic('error');
      setError(res.error);
    }
  };

  const onChange = (text: string) => {
    const clean = text
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, CODE_LENGTH);
    setCode(clean);
    setError(null);
    if (clean.length === CODE_LENGTH) void join(clean);
  };

  return (
    <Screen gradient={gradients.lobby}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Txt size={17} weight="semibold">
            ← Back
          </Txt>
        </Pressable>

        <View style={styles.center}>
          <Animated.View entering={FadeInDown.duration(300)}>
            <Txt size={60} center>
              🔑
            </Txt>
            <Txt size={34} weight="bold" center>
              Enter room code
            </Txt>
            <Txt size={16} center color={colors.muted}>
              Ask the host for the 4-letter code
            </Txt>
          </Animated.View>

          <Shake trigger={error}>
            <Pressable onPress={() => input.current?.focus()} style={styles.boxes}>
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const ch = code[i];
                const active = i === code.length;
                return (
                  <Animated.View
                    key={i}
                    entering={ZoomIn.delay(100 + i * 70).duration(300)}
                    style={[styles.box, active && styles.boxActive, ch && styles.boxFilled]}
                  >
                    {ch ? (
                      <Animated.View key={ch + i} entering={ZoomIn.duration(300)}>
                        <Txt size={38} weight="bold" color={colors.ink}>
                          {ch}
                        </Txt>
                      </Animated.View>
                    ) : null}
                  </Animated.View>
                );
              })}
              <TextInput
                testID="code-input"
                ref={input}
                value={code}
                onChangeText={onChange}
                autoFocus
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={CODE_LENGTH}
                style={styles.hiddenInput}
                caretHidden
              />
            </Pressable>
          </Shake>

          {error && (
            <Animated.View entering={FadeIn}>
              <Txt size={16} center color={colors.yellow}>
                {error}
              </Txt>
            </Animated.View>
          )}
        </View>

        <Button
          testID="join-submit"
          title="Join"
          icon="🎉"
          variant="secondary"
          disabled={code.length !== CODE_LENGTH}
          loading={joining}
          onPress={() => void join()}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: 8 },
  center: { flex: 1, justifyContent: 'center', gap: 28 },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  box: {
    width: 68,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 2,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.yellow, borderWidth: 3 },
  boxFilled: { backgroundColor: colors.white, borderColor: colors.white },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.011,
    color: 'transparent',
    fontFamily: fonts.bold,
  },
});
