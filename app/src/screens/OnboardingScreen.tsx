import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { Button, Card, haptic, Screen, Shake, Txt } from '../components/ui';
import { checkAccess, requestAccess, sourceSummary, USES_PICKER, type AccessStatus } from '../photos/photoSource';
import { colors, fonts, gradients, radius } from '../theme';

export function OnboardingScreen({
  initialName,
  skipToName,
  onDone,
}: {
  initialName: string;
  skipToName: boolean;
  onDone: (name: string) => void;
}) {
  const [step, setStep] = useState<'loading' | 'photos' | 'name'>(skipToName ? 'name' : 'loading');
  const [status, setStatus] = useState<AccessStatus>('undetermined');
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skipToName) return;
    // If access was already granted on an earlier launch there is nothing to ask.
    void checkAccess().then((s) => {
      setStatus(s);
      setStep(s === 'granted' ? 'name' : 'photos');
    });
  }, [skipToName]);

  const ask = async () => {
    if (status === 'blocked') {
      void Linking.openSettings();
      return;
    }
    setAsking(true);
    try {
      const s = await requestAccess();
      setStatus(s);
      if (s === 'granted') {
        haptic('success');
        setStep('name');
      } else {
        haptic('error');
      }
    } finally {
      setAsking(false);
    }
  };

  const submit = () => {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean) {
      setError('Pick a name so your friends know who you are!');
      haptic('error');
      return;
    }
    onDone(clean);
  };

  return (
    <Screen gradient={gradients.welcome}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hero}>
          <Polaroids />
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Txt size={46} weight="bold" center style={styles.logo}>
              Photo
            </Txt>
            <Txt size={46} weight="bold" center color={colors.yellow} style={[styles.logo, { marginTop: -14 }]}>
              Roulette
            </Txt>
            <Txt size={17} center color={colors.muted}>
              Whose camera roll is it anyway?
            </Txt>
          </Animated.View>
        </View>

        <View style={styles.bottom}>
          {step === 'photos' && (
            <Animated.View key="photos" entering={FadeInUp.springify()} exiting={FadeOutUp.duration(200)}>
              <Card style={{ gap: 10 }}>
                <Txt size={22} weight="bold">
                  {USES_PICKER ? '📸  Pick your photos' : '📸  Your camera roll'}
                </Txt>
                <Txt size={16} color={colors.muted}>
                  {USES_PICKER
                    ? "Choose a bunch of photos from your device. Each round we'll show a random one to the room."
                    : "Each round we'll show a random photo from someone's camera roll. Photos are only shared with your room and are deleted when the game ends."}
                </Txt>
                {status === 'denied' && (
                  <Animated.View entering={FadeIn}>
                    <Txt size={15} color={colors.yellow}>
                      {USES_PICKER
                        ? 'No photos chosen yet — pick at least one to play.'
                        : 'Photo access is needed to play. Tap below to try again.'}
                    </Txt>
                  </Animated.View>
                )}
                {status === 'blocked' && (
                  <Animated.View entering={FadeIn}>
                    <Txt size={15} color={colors.yellow}>
                      Photo access is turned off. Enable it for Photo Roulette in Settings, then come back.
                    </Txt>
                  </Animated.View>
                )}
              </Card>
              <Button
                testID="allow-photos"
                style={{ marginTop: 16 }}
                title={status === 'blocked' ? 'Open Settings' : USES_PICKER ? 'Choose photos' : 'Allow photo access'}
                icon={status === 'blocked' ? '⚙️' : '🎞️'}
                loading={asking}
                onPress={ask}
              />
            </Animated.View>
          )}

          {step === 'name' && (
            <Animated.View key="name" entering={FadeInUp.springify()}>
              <Card style={{ gap: 12 }}>
                <Txt size={22} weight="bold">
                  👋 What should we call you?
                </Txt>
                {sourceSummary() && (
                  <Txt size={14} color={colors.green}>
                    ✓ {sourceSummary()}
                  </Txt>
                )}
                <Shake trigger={error}>
                  <TextInput
                    testID="name-input"
                    value={name}
                    onChangeText={(t) => {
                      setName(t);
                      setError(null);
                    }}
                    placeholder="Your name"
                    placeholderTextColor="rgba(30,11,59,0.4)"
                    maxLength={16}
                    autoFocus={Platform.OS !== 'web'}
                    autoCorrect={false}
                    autoCapitalize="words"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    style={styles.input}
                  />
                </Shake>
                {error && (
                  <Animated.View entering={FadeIn}>
                    <Txt size={14} color={colors.yellow}>
                      {error}
                    </Txt>
                  </Animated.View>
                )}
              </Card>
              <Button testID="name-continue" style={{ marginTop: 16 }} title="Let's play" icon="🚀" onPress={submit} />
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Three tilted "photos" that drop in and bob gently. */
function Polaroids() {
  const cards = [
    { emoji: '🏖️', color: colors.cyan, rotate: -14, x: -70, delay: 0 },
    { emoji: '🐶', color: colors.yellow, rotate: 4, x: 0, delay: 120 },
    { emoji: '🍕', color: colors.pink, rotate: 16, x: 70, delay: 240 },
  ];
  return (
    <View style={styles.polaroids}>
      {cards.map((c) => (
        <Polaroid key={c.emoji} {...c} />
      ))}
    </View>
  );
}

function Polaroid({
  emoji,
  color,
  rotate,
  x,
  delay,
}: {
  emoji: string;
  color: string;
  rotate: number;
  x: number;
  delay: number;
}) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.set(
      withDelay(
        delay + 600,
        withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1),
      ),
    );
  }, [bob, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x }, { translateY: -8 * bob.value }, { rotate: `${rotate + bob.value * 3}deg` }],
  }));
  return (
    <Animated.View entering={ZoomIn.delay(delay).springify().damping(10)} style={styles.polaroidSlot}>
      <Animated.View style={[styles.polaroid, style]}>
        <View style={[styles.polaroidPhoto, { backgroundColor: color }]}>
          <Txt size={40}>{emoji}</Txt>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  logo: {
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 4 },
  },
  bottom: { paddingBottom: 8 },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    height: 58,
    fontSize: 22,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  polaroids: { height: 150, width: 260, alignItems: 'center', justifyContent: 'center' },
  polaroidSlot: { position: 'absolute' },
  polaroid: {
    backgroundColor: colors.white,
    padding: 8,
    paddingBottom: 26,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  polaroidPhoto: { width: 92, height: 92, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
});
