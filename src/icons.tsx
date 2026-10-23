/** Simple line icons for the tab bar and buttons (24×24 paths, drawn with react-native-svg). */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = { size?: number; color: string; filled?: boolean };

const line = (color: string) => ({ fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export function PhoneIcon({ size = 30, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8z" />
    </Svg>
  );
}

export function BackspaceIcon({ size = 30, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...line(color)} strokeWidth={1.6} d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7z" />
      <Path {...line(color)} strokeWidth={1.6} d="M11.5 9.5l5 5M16.5 9.5l-5 5" />
    </Svg>
  );
}

export function KeypadIcon({ size = 24, color, filled }: Props) {
  const dots = [5, 12, 19].flatMap(y => [5, 12, 19].map(x => [x, y])).concat([[12, 22.5]]);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 25">
      {dots.map(([x, y]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={filled ? 2.4 : 2} fill={color} />)}
    </Svg>
  );
}

export function RecentsIcon({ size = 24, color, filled }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={filled ? 2.4 : 1.8} />
      <Path {...line(color)} strokeWidth={filled ? 2.4 : 1.8} d="M12 7v5l3 2" />
    </Svg>
  );
}

export function MessagesIcon({ size = 24, color, filled }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} strokeLinejoin="round"
        d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

export function VoicemailIcon({ size = 24, color, filled }: Props) {
  const w = filled ? 2.4 : 1.8;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={6.5} cy={12} r={4} fill="none" stroke={color} strokeWidth={w} />
      <Circle cx={17.5} cy={12} r={4} fill="none" stroke={color} strokeWidth={w} />
      <Path stroke={color} strokeWidth={w} d="M6.5 16h11" />
    </Svg>
  );
}

export function SettingsIcon({ size = 24, color, filled }: Props) {
  const w = filled ? 2.2 : 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="none" stroke={color} strokeWidth={w} strokeLinejoin="round"
        d="M10.3 3h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.7v1.8l1.8 1.7-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9 1.8-1.7v-1.8L4.2 8.4l1.7-2.9 2.3.8 1.6-.9z" />
      <Circle cx={12} cy={12} r={2.8} fill="none" stroke={color} strokeWidth={w} />
    </Svg>
  );
}

export function PlayIcon({ size = 22, color }: Props) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={color} d="M8 5.5v13l11-6.5z" /></Svg>;
}

export function PauseIcon({ size = 22, color }: Props) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={color} d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></Svg>;
}
