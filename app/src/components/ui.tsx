import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, gradients, radius } from '../theme';

export function haptic(kind: 'tap' | 'success' | 'error' = 'tap') {
  if (Platform.OS === 'web') return;
  if (kind === 'tap') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else
    void Haptics.notificationAsync(
      kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
}

// ------------------------------------------------------------------- text

type Weight = keyof typeof fonts;

export function Txt({
  size = 16,
  weight = 'medium',
  color = colors.white,
  center,
  style,
  ...rest
}: TextProps & { size?: number; weight?: Weight; color?: string; center?: boolean }) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fonts[weight], fontSize: size, color }, center && { textAlign: 'center' }, style]}
    />
  );
}

// ----------------------------------------------------------------- screen

export function Screen({
  gradient,
  children,
  style,
}: {
  gradient: readonly [string, string, ...string[]];
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      <Blobs />
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }, style]}>
        {children}
      </View>
    </LinearGradient>
  );
}

/** Soft floating light blobs that make the gradient feel alive. */
function Blobs() {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <Blob size={260} color="rgba(255,255,255,0.10)" style={{ top: -80, right: -90 }} duration={7000} />
      <Blob size={200} color="rgba(76,201,240,0.18)" style={{ bottom: 60, left: -80 }} duration={9000} />
      <Blob size={140} color="rgba(255,214,10,0.14)" style={{ top: '40%', right: -40 }} duration={8000} />
    </View>
  );
}

function Blob({ size, color, style, duration }: { size: number; color: string; style: ViewStyle; duration: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [duration, t]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: t.value * 30 - 15 }, { scale: 1 + t.value * 0.12 }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
        animated,
      ]}
    />
  );
}

// ---------------------------------------------------------------- buttons

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  size = 'lg',
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
  testID?: string;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? colors.ink : colors.white;
  const height = size === 'lg' ? 60 : 48;

  const content = (
    <View style={[styles.buttonInner, { height }]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Txt size={size === 'lg' ? 20 : 17} weight="bold" color={textColor}>
          {icon ? `${icon}  ` : ''}
          {title}
        </Txt>
      )}
    </View>
  );

  return (
    <Animated.View style={[animated, inactive && { opacity: 0.5 }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={inactive}
        onPressIn={() => scale.set(withTiming(0.96, { duration: 90 }))}
        onPressOut={() => scale.set(withTiming(1, { duration: 150 }))}
        onPress={() => {
          haptic();
          onPress?.();
        }}
      >
        {variant === 'ghost' ? (
          <View style={[styles.button, styles.ghost]}>{content}</View>
        ) : (
          <LinearGradient
            colors={gradients[variant]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.button, styles.buttonShadow]}
          >
            {content}
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ----------------------------------------------------------------- misc

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Avatar({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: size > 40 ? 3 : 2 },
      ]}
    >
      <Txt size={size * 0.45} weight="bold" color={colors.ink}>
        {name.trim().charAt(0).toUpperCase()}
      </Txt>
    </View>
  );
}

export function Pill({
  children,
  color = colors.glassStrong,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.pill, { backgroundColor: color }, style]}>{children}</View>;
}

/** Counts smoothly from its previous value to `value`. */
export function AnimatedNumber({
  value,
  duration = 900,
  style,
  prefix = '',
}: {
  value: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = Date.now();
    const initial = from.current;
    let frame: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(initial + (value - initial) * eased);
      setShown(v);
      from.current = v;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return (
    <Text style={style}>
      {prefix}
      {shown.toLocaleString()}
    </Text>
  );
}

/** Wiggles whenever `trigger` changes (used for error messages). */
export function Shake({ trigger, children }: { trigger: unknown; children: ReactNode }) {
  const x = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    x.set(
      withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-7, { duration: 50 }),
        withTiming(7, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      ),
    );
  }, [trigger, x]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  button: { borderRadius: radius.pill, overflow: 'hidden' },
  buttonShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  buttonInner: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ghost: { backgroundColor: colors.glass, borderWidth: 1.5, borderColor: colors.glassBorder },
  card: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 18,
  },
  avatar: { alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(255,255,255,0.9)' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start' },
});
