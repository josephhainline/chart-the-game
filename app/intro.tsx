import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Dots from '@/components/intro/Dots';
import { Button } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { useStore } from '@/lib/store';

const PAGE_COUNT = 3;
/** Height reserved at the bottom of every page for the dots and buttons. */
const FOOTER_HEIGHT = 128;

/**
 * The coach's own photos, cropped from the prototype's teaser screens (the
 * text-free regions, already faded toward white so copy stays legible).
 */
const PHOTOS = {
  field: require('../assets/images/intro/field.jpg'),
  batter: require('../assets/images/intro/batter.jpg'),
  infieldEdge: require('../assets/images/intro/infield-edge.jpg'),
  homePlate: require('../assets/images/intro/home-plate.jpg'),
  chalkLines: require('../assets/images/intro/chalk-lines.jpg'),
};

/**
 * First-launch onboarding: the title band, then three swipeable teaser pages.
 * Desktop users can't swipe, so there is a Next button and tappable dots too.
 */
export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Set by the root layout when a first-time deep link was intercepted.
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { setOnboarded } = useStore();
  const scrollRef = useRef<ScrollView>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0);
  const { width, height } = size;

  const enter = () => {
    setOnboarded(true);
    // Only in-app paths: never follow a "next" that points off the site.
    const destination = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    router.replace(destination);
  };

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(PAGE_COUNT - 1, i));
      setIndex(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    },
    [width],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w !== width || h !== height) setSize({ width: w, height: h });
  };

  // Keep the current page in place if the column is resized.
  useEffect(() => {
    if (width > 0) scrollRef.current?.scrollTo({ x: index * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i >= 0 && i < PAGE_COUNT) setIndex((prev) => (prev === i ? prev : i));
  };

  // Arrow keys page through on web.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index]);

  const pageStyle = { width, height };
  const footerHeight = FOOTER_HEIGHT + insets.bottom + 12;
  // Copy sits in the pale sky/overlay above each photo, like the prototype.
  const copyStyle = { paddingTop: Math.round(height * 0.1), paddingBottom: 18 };
  // Page 3 stacks a strip of outfield, the band, home plate, then chalk lines
  // under the closing line and the buttons. Keep the chalk block from eating
  // the whole page on short phones.
  const stripHeight = Math.round(height * 0.14);
  const chalkHeight = Math.min(footerHeight + 150, Math.round(height * 0.6));
  // Scale the teaser type down on narrow phones so the prototype's line breaks hold.
  const teaserSize = { fontSize: Math.min(30, Math.round(width * 0.07)), lineHeight: Math.min(40, Math.round(width * 0.093)) };
  const last = index === PAGE_COUNT - 1;

  return (
    <View style={styles.root}>
      <View style={[styles.titleBand, { paddingTop: insets.top + 22 }]}>
        <Text style={styles.title}>Chart The Game</Text>
        <Text style={styles.subtitle}>a Coach Rob Floyd app</Text>
        <Pressable
          onPress={enter}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Skip intro"
          style={({ pressed }) => [styles.skip, { top: insets.top + 20 }, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.carousel} onLayout={onLayout}>
        {width > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            bounces={false}
            overScrollMode="never"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={styles.scroll}
          >
            <View style={[styles.page, pageStyle]}>
              <View style={[styles.copy, copyStyle]}>
                <Text style={[styles.teaser, teaserSize]}>
                  Are you <Text style={styles.accent}>really</Text> winning{'\n'}the game of baseball?
                </Text>
              </View>
              <Image source={PHOTOS.field} style={styles.photoFill} resizeMode="cover" accessibilityIgnoresInvertColors />
            </View>

            <View style={[styles.page, pageStyle]}>
              <View style={[styles.copy, copyStyle]}>
                <Text style={[styles.teaser, teaserSize]}>
                  <Text style={styles.accent}>Every game</Text> is a series of{'\n'}1-on-1 battles:
                </Text>
              </View>
              <ImageBackground source={PHOTOS.batter} style={styles.photoFill} resizeMode="cover" accessibilityIgnoresInvertColors>
                <View style={styles.grow} />
                <View style={[styles.orangeBand, { marginBottom: footerHeight }]}>
                  <Text style={styles.bandText}>Batter vs. Pitcher</Text>
                </View>
              </ImageBackground>
            </View>

            <View style={[styles.page, pageStyle]}>
              <Image source={PHOTOS.infieldEdge} style={[styles.photoStrip, { height: stripHeight }]} resizeMode="cover" accessibilityIgnoresInvertColors />
              <View style={styles.orangeBand}>
                <Text style={styles.bandText}>Master the game{'\n'}within the game</Text>
              </View>
              <Image source={PHOTOS.homePlate} style={styles.photoFill} resizeMode="cover" accessibilityIgnoresInvertColors />
              <ImageBackground source={PHOTOS.chalkLines} style={[styles.photoStrip, { height: chalkHeight }]} resizeMode="cover" accessibilityIgnoresInvertColors>
                <Text style={[styles.teaser, teaserSize, styles.teaserOrange, styles.closing]}>
                  and take your baseball{'\n'}journey further than{'\n'}you thought possible!
                </Text>
              </ImageBackground>
            </View>
          </ScrollView>
        ) : null}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
          <Dots count={PAGE_COUNT} index={index} onSelect={goTo} />
          <View style={styles.buttons}>
            {last ? (
              <>
                <Button title="Log In" variant="gray" size="lg" style={styles.footerButton} onPress={enter} />
                <Button title="Sign Up" variant="orange" size="lg" style={styles.footerButton} onPress={enter} />
              </>
            ) : (
              <Button title="Next" variant="orange" size="lg" style={styles.footerButton} onPress={() => goTo(index + 1)} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  titleBand: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 64,
  },
  title: { fontFamily: fonts.bold, fontSize: 34, color: '#fff', textAlign: 'center' },
  subtitle: { fontFamily: fonts.bold, fontSize: 17, color: '#fff', textAlign: 'center', marginTop: 2 },
  skip: {
    position: 'absolute',
    right: 8,
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  skipText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff', opacity: 0.9 },
  pressed: { opacity: 0.6 },
  carousel: { flex: 1, overflow: 'hidden' },
  scroll: { flex: 1 },
  page: { overflow: 'hidden', backgroundColor: colors.surface },
  copy: { backgroundColor: colors.surface },
  photoFill: { flex: 1, width: '100%' },
  photoStrip: { width: '100%' },
  closing: { paddingTop: 28 },
  grow: { flex: 1 },
  teaser: {
    fontFamily: fonts.italic,
    fontSize: 30,
    lineHeight: 40,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  accent: { fontFamily: fonts.boldItalic, color: colors.orange },
  teaserOrange: { color: colors.orange },
  orangeBand: {
    backgroundColor: colors.orange,
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  bandText: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 46, color: '#fff', textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    gap: 12,
  },
  buttons: { flexDirection: 'row', gap: 16, paddingHorizontal: 24 },
  footerButton: { flex: 1, height: 52 },
});
