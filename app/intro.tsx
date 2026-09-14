import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { useStore } from '@/lib/store';

export default function IntroScreen() {
  const router = useRouter();
  const { setOnboarded } = useStore();
  const enter = () => {
    setOnboarded(true);
    router.replace('/');
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 36, color: '#fff' }}>Chart The Game</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff', marginBottom: 32 }}>a Coach Rob Floyd app</Text>
      <Button title="Get Started" variant="orange" onPress={enter} />
    </View>
  );
}
