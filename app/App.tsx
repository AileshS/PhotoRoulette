import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from './src/components/ui';
import { photoUrl } from './src/config';
import { game, useGame } from './src/game/client';
import { CollectingScreen } from './src/screens/CollectingScreen';
import { FinalScreen } from './src/screens/FinalScreen';
import { JoinScreen } from './src/screens/JoinScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { RoundScreen } from './src/screens/RoundScreen';
import { colors } from './src/theme';

type Stage = 'onboarding' | 'menu' | 'join';

export default function App() {
  const [fontsLoaded] = useFonts({ Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold });
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        {fontsLoaded ? <Game /> : <ActivityIndicator color={colors.white} style={{ flex: 1 }} />}
      </View>
    </SafeAreaProvider>
  );
}

function Game() {
  const snap = useGame();
  const [stage, setStage] = useState<Stage>('onboarding');
  const [editingName, setEditingName] = useState(false);
  const room = snap.room;

  // Leaving (or being dropped from) a room always lands back on the menu.
  const wasInRoom = useRef(false);
  useEffect(() => {
    if (wasInRoom.current && !room) setStage('menu');
    wasInRoom.current = !!room;
  }, [room]);

  // Preload the next photo while players look at the leaderboard.
  useEffect(() => {
    if (room?.nextPhotoUrl) void Image.prefetch(photoUrl(room.nextPhotoUrl)).catch(() => {});
  }, [room?.nextPhotoUrl]);

  let key: string;
  let screen: ReactNode;
  if (room) {
    switch (room.phase) {
      case 'lobby':
        key = 'lobby';
        screen = <LobbyScreen room={room} />;
        break;
      case 'collecting':
        key = 'collecting';
        screen = <CollectingScreen room={room} sharing={snap.sharingPhotos} />;
        break;
      case 'question':
      case 'reveal':
        // Question and reveal share a key so the photo stays put while the answer is revealed.
        key = `round-${room.round?.index}`;
        screen = <RoundScreen room={room} clockOffset={snap.clockOffset} />;
        break;
      case 'leaderboard':
        key = `board-${room.round?.index}`;
        screen = <LeaderboardScreen room={room} />;
        break;
      case 'finished':
        key = 'finished';
        screen = <FinalScreen room={room} />;
        break;
    }
  } else if (stage === 'onboarding') {
    key = editingName ? 'rename' : 'onboarding';
    screen = (
      <OnboardingScreen
        initialName={snap.name}
        skipToName={editingName}
        onDone={(name) => {
          game.setName(name);
          setEditingName(false);
          setStage('menu');
        }}
      />
    );
  } else if (stage === 'join') {
    key = 'join';
    screen = <JoinScreen onBack={() => setStage('menu')} />;
  } else {
    key = 'menu';
    screen = (
      <MenuScreen
        name={snap.name}
        notice={snap.kicked}
        onJoin={() => setStage('join')}
        onEditName={() => {
          setEditingName(true);
          setStage('onboarding');
        }}
      />
    );
  }

  return (
    <>
      <Animated.View
        key={key!}
        entering={FadeIn.duration(420)}
        exiting={FadeOut.duration(320)}
        style={StyleSheet.absoluteFill}
      >
        {screen}
      </Animated.View>
      {room && snap.status !== 'online' && <ReconnectingBanner />}
    </>
  );
}

function ReconnectingBanner() {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={[styles.banner, { top: insets.top + 6 }]}>
      <ActivityIndicator color={colors.ink} size="small" />
      <Txt size={14} weight="semibold" color={colors.ink}>
        Reconnecting…
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A0B4A' },
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.yellow,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
});
