import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Screen from '@/components/Screen';
import { colors, fonts, radii, type } from '@/constants/theme';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

const BENEFITS = [
  {
    emoji: '⚾',
    title: 'Detailed At-Bat Analysis:',
    body: 'Rank your players based on our proprietary CTG metrics: the game within the game.',
  },
  {
    emoji: '📊',
    title: 'Player Evaluation:',
    body: 'See who excelled in every situation.',
  },
  {
    emoji: '🏅',
    title: 'Winning Insights:',
    body: 'Use this data to make smarter decisions on training and strategy, building a winning team from the ground up.',
  },
];

type LinkKey = 'privacy' | 'contact';

export default function AboutScreen() {
  const [note, setNote] = useState<LinkKey | null>(null);
  const toggle = (key: LinkKey) => setNote((current) => (current === key ? null : key));

  return (
    <Screen>
      <AppHeader subtitle />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Text style={styles.heading}>What is Chart The Game (CTG)?</Text>

        <Text style={styles.paragraph}>
          Chart The Game (CTG) is more than just a baseball analysis tool—it's your key to unlocking the true essence of
          the game.
        </Text>
        <Text style={styles.paragraph}>
          Every at-bat is a battle between the pitcher and the batter, and while the final score tells part of the
          story, it doesn't capture who really won these crucial encounters.
        </Text>
        <Text style={styles.paragraph}>
          For coaches, understanding these battles will transform your strategy and player development. CTG allows you
          to dig deeper, tracking and recording each at-bat to reveal the players' true performance.
        </Text>

        <Text style={[styles.heading, styles.headingTight]}>With CTG you get:</Text>
        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefit}>
              <Text style={styles.emoji}>{b.emoji}</Text>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitBody}>{b.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.ctaWrap}>
          <View style={styles.ctaBlueLayer} />
          <View style={styles.ctaGrayLayer} />
          <View style={styles.cta}>
            <Text style={styles.ctaText}>
              Ready to discover the real game within the game? Subscribe to CTG and elevate your baseball strategy!
            </Text>
          </View>
        </View>

        <View style={styles.links}>
          <View style={styles.linkCol}>
            <Pressable
              onPress={() => toggle('privacy')}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
              hitSlop={8}
              style={({ pressed }) => [styles.linkPress, pressed && styles.pressed, webCursor]}
            >
              <Text style={styles.link}>Privacy Policy</Text>
            </Pressable>
            {note === 'privacy' ? <Text style={styles.note}>Coming soon</Text> : null}
          </View>
          <View style={[styles.linkCol, styles.linkColRight]}>
            <Pressable
              onPress={() => toggle('contact')}
              accessibilityRole="link"
              accessibilityLabel="Contact Us"
              hitSlop={8}
              style={({ pressed }) => [styles.linkPress, pressed && styles.pressed, webCursor]}
            >
              <Text style={styles.link}>Contact Us</Text>
            </Pressable>
            {note === 'contact' ? <Text style={[styles.note, styles.noteRight]}>Coming soon</Text> : null}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Prototype (15f203f5…): 14.5pt underlined headings, 12.5pt body on ~15.5pt
  // leading, 14.5pt benefit titles and links — the whole page fits one screen.
  scroll: { flex: 1 },
  body: { paddingHorizontal: 28, paddingTop: 18, paddingBottom: 28 },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    textDecorationLine: 'underline',
    marginBottom: 10,
  },
  headingTight: { marginTop: 6, marginBottom: 6 },
  paragraph: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: colors.text, marginBottom: 12 },
  benefits: { gap: 12, paddingLeft: 10 },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  emoji: { fontSize: 16, lineHeight: 20, width: 24, textAlign: 'center' },
  benefitText: { flex: 1, gap: 3 },
  benefitTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text },
  benefitBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: colors.text },
  ctaWrap: { marginTop: 24, marginHorizontal: -12, position: 'relative' },
  ctaBlueLayer: {
    position: 'absolute',
    top: -10,
    left: -14,
    right: 24,
    bottom: 10,
    backgroundColor: colors.primary,
  },
  ctaGrayLayer: {
    position: 'absolute',
    top: 10,
    left: 24,
    right: -14,
    bottom: -10,
    backgroundColor: colors.buttonGray,
  },
  cta: {
    backgroundColor: colors.navy,
    borderRadius: radii.sm,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  ctaText: {
    fontFamily: fonts.italic,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 21,
    color: colors.white,
    textAlign: 'center',
  },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 },
  linkCol: { flex: 1, alignItems: 'flex-start' },
  linkColRight: { alignItems: 'flex-end' },
  linkPress: { minHeight: 44, justifyContent: 'center' },
  link: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  note: { ...type.caption, fontSize: 12, marginTop: 2 },
  noteRight: { textAlign: 'right' },
  pressed: { opacity: 0.6 },
});
