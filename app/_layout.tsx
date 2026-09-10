import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export const COLORS = {
  bg: '#0F0F12',
  card: '#1B1B1F',
  border: '#34343A',
  textMuted: '#8F8F98',
  mint: '#A1FF75',
  bubblegum: '#FF78CB',
  lilac: '#C9B1FF',
  yellow: '#FFE74A',
  white: '#FFFFFF',
};

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.white,
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="mint/[id]" options={{ title: '' }} />
      </Stack>
    </>
  );
}
