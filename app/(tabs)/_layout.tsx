import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../lib/theme';

function Dot({ focused, color }: { focused: boolean; color: string }) {
  return (
    <View
      style={[
        styles.dot,
        { borderColor: color, backgroundColor: focused ? color : 'transparent' },
      ]}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.ink,
        tabBarInactiveTintColor: COLORS.inkMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 12,
          paddingTop: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'home',
          tabBarIcon: ({ focused }) => <Dot focused={focused} color={COLORS.bubblegum} />,
        }}
      />
      <Tabs.Screen
        name="drops"
        options={{
          title: 'drops',
          tabBarIcon: ({ focused }) => <Dot focused={focused} color={COLORS.mint} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'collection',
          tabBarIcon: ({ focused }) => <Dot focused={focused} color={COLORS.lilac} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dot: { width: 12, height: 12, borderRadius: 4, borderWidth: 2 },
});