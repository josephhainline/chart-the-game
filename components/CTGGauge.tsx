import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { colors, fonts } from '@/constants/theme';

export type NeedleSide = 'center' | 'L' | 'W';

type Props = {
  /** Where the needle should swing. 'L'/'W' swing toward that result's side, then ease back to center. */
  needle: NeedleSide;
  /** Bump this to replay the swing when the same result is recorded twice in a row. */
  pulse?: number;
  /**
   * 'batter' (default): red L ticks on the left, green W ticks on the right.
   * 'pitcher': mirrored so the green (our pitcher won) side is on the left,
   * matching the outcome button columns when the opponent is batting.
   */
  perspective?: 'batter' | 'pitcher';
  /** Rendered width in px. Height follows the semicircle's proportions. */
  width?: number;
};

/* Geometry in viewBox units. */
const VB_W = 120;
const VB_H = 76;
const CX = 60;
const CY = 60;
const R_ARC = 54;
const ARC_STROKE = 6.5;
const TICK_INNER = 35;
const TICK_OUTER = 46;
const TICK_STROKE = 4.5;
const TICKS = 13; // six red, one amber, six green
const HUB_BOX = 64; // side of the square that the needle rotates inside
const SWING_DEG = 62;

const NEEDLE_PATH = 'M 0 -30 L 11 -4.8 A 12 12 0 1 1 -11 -4.8 Z';

/**
 * The "Chart The Game" gauge from the prototype: a gray semicircle, thirteen
 * tick marks (loss side, amber center, win side) and a gray teardrop needle
 * that swings toward the recorded result and eases back to center.
 */
export default function CTGGauge({ needle, pulse = 0, perspective = 'batter', width = 112 }: Props) {
  const angle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (needle === 'center') {
      Animated.timing(angle, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      return;
    }
    const goesRight = needle === 'W' ? perspective === 'batter' : perspective === 'pitcher';
    Animated.sequence([
      Animated.timing(angle, {
        toValue: goesRight ? SWING_DEG : -SWING_DEG,
        duration: 260,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: false,
      }),
      Animated.delay(700),
      Animated.timing(angle, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [needle, pulse, perspective, angle]);

  const k = width / VB_W;
  const height = VB_H * k;
  const hubSize = HUB_BOX * k;
  const rotate = angle.interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] });

  const mid = (TICKS - 1) / 2;
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const deg = 180 - (i * 180) / (TICKS - 1);
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const leftSide = i < mid;
    const color = i === mid ? colors.amber : leftSide === (perspective === 'batter') ? colors.loss : colors.win;
    return (
      <Line
        key={i}
        x1={CX + TICK_INNER * cos}
        y1={CY - TICK_INNER * sin}
        x2={CX + TICK_OUTER * cos}
        y2={CY - TICK_OUTER * sin}
        stroke={color}
        strokeWidth={TICK_STROKE}
        strokeLinecap="round"
      />
    );
  });

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Chart The Game gauge">
      <View style={{ width, height }}>
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={StyleSheet.absoluteFill}>
          <Path
            d={`M ${CX - R_ARC} ${CY} A ${R_ARC} ${R_ARC} 0 0 1 ${CX + R_ARC} ${CY}`}
            stroke={colors.buttonGray}
            strokeWidth={ARC_STROKE}
            fill="none"
          />
          {ticks}
        </Svg>
        <Animated.View
          style={{
            position: 'absolute',
            left: CX * k - hubSize / 2,
            top: CY * k - hubSize / 2,
            width: hubSize,
            height: hubSize,
            transform: [{ rotate }],
          }}
        >
          <Svg width={hubSize} height={hubSize} viewBox={`${-HUB_BOX / 2} ${-HUB_BOX / 2} ${HUB_BOX} ${HUB_BOX}`}>
            <Path d={NEEDLE_PATH} fill={colors.buttonGray} />
          </Svg>
        </Animated.View>
      </View>
      <Text style={styles.caption}>Chart The Game</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  caption: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
