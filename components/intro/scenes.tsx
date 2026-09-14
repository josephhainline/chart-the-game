import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { colors } from '@/constants/theme';

/**
 * Quiet, on-palette backdrops for the three intro pages. The prototype uses
 * photographs; these stand in with pale field compositions so the copy stays
 * the focus. Each scene fills its page and is drawn in pixel coordinates.
 */

type SceneProps = { width: number; height: number };

const SKY_TOP = '#FFFFFF';
const SKY_BOTTOM = '#E4F3FD';
const GRASS = '#E1EFD9';
const GRASS_FAR = '#EAF3E4';
const DIRT = '#F7E7D9';
const DIRT_DEEP = '#F1DBC8';
const CHALK = '#FFFFFF';
const SEAM = colors.orange;

/** Home plate pentagon (flat edge on top, point at the bottom), centred on (cx, cy). */
function plate(cx: number, cy: number, size: number): string {
  const h = size / 2;
  return [
    `${cx - h},${cy - h}`,
    `${cx + h},${cy - h}`,
    `${cx + h},${cy}`,
    `${cx},${cy + h}`,
    `${cx - h},${cy}`,
  ].join(' ');
}

/** Small chalk square used for 1st/2nd/3rd base. */
function base(cx: number, cy: number, size: number) {
  return <Rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} fill={CHALK} opacity={0.95} />;
}

/** Page 1: a wide view of a ball field, sky over outfield over a chalked infield diamond. */
export function FieldScene({ width: w, height: h }: SceneProps) {
  const horizon = h * 0.5;
  const home = { x: w * 0.5, y: h * 0.8 };
  const first = { x: w * 0.8, y: h * 0.675 };
  const second = { x: w * 0.5, y: h * 0.55 };
  const third = { x: w * 0.2, y: h * 0.675 };
  const mound = { x: w * 0.5, y: h * 0.68 };
  const diamond = `${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`;
  // Grass cut-out inside the base paths.
  const inset = 0.24;
  const inner = [
    [home.x, home.y - (home.y - second.y) * inset],
    [first.x - (first.x - third.x) * (inset / 2), first.y],
    [second.x, second.y + (home.y - second.y) * inset],
    [third.x + (first.x - third.x) * (inset / 2), third.y],
  ]
    .map((p) => p.join(','))
    .join(' ');
  const foulEndY = home.y + (h - home.y) * 0.9;

  return (
    <Svg width={w} height={h} style={styles.fill} pointerEvents="none">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SKY_TOP} />
          <Stop offset="1" stopColor={SKY_BOTTOM} />
        </LinearGradient>
        <LinearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GRASS_FAR} />
          <Stop offset="1" stopColor={GRASS} />
        </LinearGradient>
        <LinearGradient id="dirt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={DIRT} />
          <Stop offset="1" stopColor={DIRT_DEEP} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={horizon} fill="url(#sky)" />
      <Rect x={0} y={horizon} width={w} height={h - horizon} fill="url(#grass)" />
      {/* Outfield fence line on the horizon. */}
      <Line x1={0} y1={horizon} x2={w} y2={horizon} stroke="#C9DDF0" strokeWidth={2} />
      {/* Infield dirt. */}
      <Ellipse cx={w * 0.5} cy={h * 0.7} rx={w * 0.42} ry={h * 0.18} fill="url(#dirt)" />
      <Polygon points={inner} fill={GRASS} />
      {/* Base paths, foul lines and bases. */}
      <Polygon points={diamond} fill="none" stroke={CHALK} strokeWidth={3} opacity={0.95} />
      <Line x1={home.x} y1={home.y} x2={w * 0.1} y2={foulEndY} stroke={CHALK} strokeWidth={3} opacity={0.6} />
      <Line x1={home.x} y1={home.y} x2={w * 0.9} y2={foulEndY} stroke={CHALK} strokeWidth={3} opacity={0.6} />
      {base(first.x, first.y, 9)}
      {base(second.x, second.y, 9)}
      {base(third.x, third.y, 9)}
      <Polygon points={plate(home.x, home.y, 13)} fill={CHALK} />
      {/* Pitcher's mound. */}
      <Ellipse cx={mound.x} cy={mound.y} rx={w * 0.065} ry={h * 0.024} fill={DIRT_DEEP} />
      <Rect x={mound.x - 6} y={mound.y - 2} width={12} height={4} fill={CHALK} />
    </Svg>
  );
}

/** Page 2: a large pale baseball rising from the lower left. */
export function BaseballScene({ width: w, height: h }: SceneProps) {
  const R = w * 0.62;
  const cx = w * 0.3;
  const cy = h * 0.66;

  // Each seam is an arc of a circle whose centre sits outside the ball, so the
  // seam bows toward the middle the way a real stitch line does.
  const seam = (side: -1 | 1) => {
    const scx = cx + side * 1.5 * R;
    const sr = 1.15 * R;
    const half = Math.atan2(0.766, 0.8575); // half-angle of the arc inside the ball
    const start = side === -1 ? -half : Math.PI - half;
    const steps = 22;
    const pts: { x: number; y: number; a: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = start + (i / steps) * 2 * half;
      pts.push({ x: scx + sr * Math.cos(a), y: cy + sr * Math.sin(a), a });
    }
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const ticks = pts
      .filter((_, i) => i % 2 === 1)
      .map((p, i) => {
        const len = R * 0.055;
        const dx = Math.cos(p.a) * len;
        const dy = Math.sin(p.a) * len;
        return <Line key={i} x1={p.x - dx} y1={p.y - dy} x2={p.x + dx} y2={p.y + dy} stroke={SEAM} strokeWidth={2.5} opacity={0.35} strokeLinecap="round" />;
      });
    return (
      <React.Fragment key={side}>
        <Path d={d} fill="none" stroke={SEAM} strokeWidth={3} opacity={0.35} strokeLinecap="round" />
        {ticks}
      </React.Fragment>
    );
  };

  return (
    <Svg width={w} height={h} style={styles.fill} pointerEvents="none">
      <Defs>
        <LinearGradient id="ballBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#EEF3F8" />
        </LinearGradient>
        <LinearGradient id="ball" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#F3F5F8" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#ballBg)" />
      <Circle cx={cx} cy={cy} r={R} fill="url(#ball)" stroke="#DCE3EC" strokeWidth={2} />
      {seam(-1)}
      {seam(1)}
    </Svg>
  );
}

/** Page 3: chalk lines around home plate, outfield grass along the top. */
export function ChalkScene({ width: w, height: h }: SceneProps) {
  const home = { x: w * 0.5, y: h * 0.44 };
  const boxW = w * 0.14;
  const boxH = h * 0.11;
  const gap = w * 0.06;
  return (
    <Svg width={w} height={h} style={styles.fill} pointerEvents="none">
      <Defs>
        <LinearGradient id="chalkBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GRASS} />
          <Stop offset="0.2" stopColor={GRASS_FAR} />
          <Stop offset="0.3" stopColor={DIRT} />
          <Stop offset="1" stopColor={DIRT_DEEP} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#chalkBg)" />
      {/* Foul lines running away from the plate toward the outfield. */}
      <Line x1={home.x} y1={home.y} x2={-w * 0.1} y2={0} stroke={CHALK} strokeWidth={5} opacity={0.85} />
      <Line x1={home.x} y1={home.y} x2={w * 1.1} y2={0} stroke={CHALK} strokeWidth={5} opacity={0.85} />
      {/* Batter's boxes either side of the plate. */}
      <Rect x={home.x - gap - boxW} y={home.y - boxH / 2} width={boxW} height={boxH} fill="none" stroke={CHALK} strokeWidth={4} opacity={0.7} />
      <Rect x={home.x + gap} y={home.y - boxH / 2} width={boxW} height={boxH} fill="none" stroke={CHALK} strokeWidth={4} opacity={0.7} />
      <Polygon points={plate(home.x, home.y, w * 0.07)} fill={CHALK} opacity={0.95} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0 },
});
