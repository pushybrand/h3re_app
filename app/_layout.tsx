import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  SpaceGrotesk_700Bold,
  SpaceGrotesk_500Medium,
} from '@expo-google-fonts/space-grotesk';
import { COLORS } from '../lib/theme';

export { COLORS };

export default function RootLayout() {
  // Kick font loading off, but never block the app on it. If it resolves,
  // screens using FONT_DISPLAY re-render with the custom face on their next
  // update; if it never resolves (or errors) for any reason, every screen
  // just keeps using the system font instead of a stuck blank screen.
  useFonts({ SpaceGrotesk_700Bold, SpaceGrotesk_500Medium });

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="mint/[id]" options={{ title: '' }} />
      </Stack>
    </>
  );
}
