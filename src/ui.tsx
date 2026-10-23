import React from 'react';
import { Image, Pressable, StyleSheet, Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps, TextStyle, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { GRADIENTS, s, usePrefs, useTheme } from './theme';

/** The font and text size picked in Settings (React Native has no app-wide font, so every screen uses these). */
function fontStyle(font: string | undefined, scale: number, style: TextProps['style']) {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  return [style, font ? { fontFamily: font } : null, scale !== 1 ? {
    fontSize: (flat.fontSize ?? 14) * scale,
    lineHeight: flat.lineHeight ? flat.lineHeight * scale : undefined,
  } : null];
}

/** Text in the picked font and size. `fixed` keeps its size (e.g. tab labels, which have only so much room). */
export function Text({ fixed, ...props }: TextProps & { fixed?: boolean }) {
  const t = useTheme();
  return <RNText {...props} style={fontStyle(t.font, fixed ? 1 : t.scale, props.style)} />;
}

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>((props, ref) => {
  const t = useTheme();
  return <RNTextInput ref={ref} {...props} style={fontStyle(t.font, t.scale, props.style)} />;
});

const STRENGTH = { low: 0.6, mid: 1, high: 1.5 };
const DIM = { low: 0.15, mid: 0.35, high: 0.55 };
const BLUR = { off: 0, low: 6, mid: 14, high: 28 };

/** Behind every screen: their photo (dimmed and blurred as they chose), a gradient, or, with Glass on a plain
 *  background, a soft wash of the accent like the shop website's Glass. Nothing when the background is plain. */
export function Backdrop() {
  const t = useTheme();
  const prefs = usePrefs();
  const full = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
  if (prefs.background === 'photo' && prefs.photo) {
    return (
      <View style={[full, { backgroundColor: t.plainBg }]}>
        <Image source={{ uri: prefs.photo }} style={full} resizeMode="cover" blurRadius={BLUR[prefs.blur]} />
        <View style={[full, { backgroundColor: t.dark ? '#000000' : '#ffffff', opacity: DIM[prefs.dim] }]} />
      </View>
    );
  }
  if (prefs.background !== 'gradient' && !t.glass) {
    return null;
  }
  const [a, b] = (prefs.background === 'gradient' && GRADIENTS[prefs.gradient]) || [t.brand, t.call];
  const k = prefs.background === 'gradient' ? STRENGTH[prefs.strength] * 1.6 : 1;
  return (
    <Svg style={full} width="100%" height="100%">
      <Defs>
        <RadialGradient id="a" cx="0%" cy="0%" r="95%">
          <Stop offset="0" stopColor={a} stopOpacity={Math.min(0.9, (t.dark ? 0.32 : 0.26) * k)} />
          <Stop offset="1" stopColor={a} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="b" cx="100%" cy="100%" r="90%">
          <Stop offset="0" stopColor={b} stopOpacity={Math.min(0.9, (t.dark ? 0.22 : 0.18) * k)} />
          <Stop offset="1" stopColor={b} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={t.dark ? '#0d0e12' : '#f3f4f8'} />
      <Rect width="100%" height="100%" fill="url(#a)" />
      <Rect width="100%" height="100%" fill="url(#b)" />
    </Svg>
  );
}

/** An icon on a frosted glass tile: a see-through tint, a light sheen from the top and a bright rim. */
export function GlassTile({ size, tint, children }: { size: number; tint: string; children: React.ReactNode }) {
  const t = useTheme();
  const r = size * 0.3;
  return (
    <View collapsable={false} style={{ width: size, height: size, borderRadius: r, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: t.dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.9)' }}>
      <Svg style={{ position: 'absolute' }} width={size} height={size}>
        <Defs>
          <LinearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={t.dark ? 0.28 : 0.75} />
            <Stop offset="0.55" stopColor="#ffffff" stopOpacity={t.dark ? 0.06 : 0.2} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} fill={tint} opacity={t.dark ? 0.45 : 0.28} />
        <Rect width={size} height={size} fill="url(#sheen)" />
      </Svg>
      {children}
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  kind?: 'brand' | 'danger' | 'plain' | 'call';
  disabled?: boolean;
  style?: object;
};

export function Button({ title, onPress, kind = 'brand', disabled, style }: ButtonProps) {
  const t = useTheme();
  const bg = { brand: t.brand, danger: t.danger, plain: t.card, call: t.call }[kind];
  const fg = { brand: t.onBrand, danger: t.onDanger, plain: t.ink, call: '#ffffff' }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, borderRadius: 16, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        kind === 'plain' && { borderWidth: 1, borderColor: t.line },
        style,
      ]}>
      <Text style={[s.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** A screen's title, with an optional action on the right. */
export function Header({ title, sub, left, right }: { title: string; sub?: string; left?: React.ReactNode; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[s.row, { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 12 }]}>
      {left}
      <View style={s.fill}>
        <Text style={{ fontSize: left ? 20 : 22, fontWeight: '700', color: t.ink }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[s.small, { color: t.muted }]} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Link({ title, onPress }: { title: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}>
      <Text style={[s.body, { color: t.brand, fontWeight: '600', fontSize: 16 }]}>{title}</Text>
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={[s.body, { color: t.muted, textAlign: 'center', padding: 32 }]}>{text}</Text>;
}

/** Pick one of a few: a segmented control. */
export function Choice<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={[s.row, { padding: 3, borderRadius: 14, backgroundColor: t.dark ? '#2c2c2e' : '#e4e4e8' }]}>
      {options.map(([key, label]) => {
        const on = key === value;
        return (
          <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(key)}
            style={[s.fill, { alignItems: 'center', paddingVertical: 8, borderRadius: 11,
              backgroundColor: on ? (t.dark ? '#636366' : '#ffffff') : 'transparent' }]}>
            <Text style={{ fontSize: 14, fontWeight: on ? '600' : '400', color: t.ink }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type TabItem<T extends string> = {
  key: T; label: string; badge?: number;
  icon: (p: { color: string; filled?: boolean; size?: number }) => React.ReactElement;
};

/** The bottom tabs: icon over label, or (glass) a see-through bar floating over the content with icons on glass tiles. */
export function TabBar<T extends string>({ tabs, active, onPress }: { tabs: TabItem<T>[]; active: T; onPress: (t: T) => void }) {
  const t = useTheme();
  // glass: the same size as the solid bar, see-through, with each icon on a small glass tile
  const bar = { backgroundColor: t.card, borderRadius: 24, borderWidth: 1, borderColor: t.line, paddingVertical: 8,
    marginHorizontal: 10, marginBottom: 8 };
  return (
    <View style={[s.row, bar]}>
      {tabs.map(tab => {
        const on = tab.key === active;
        const color = on ? t.brand : t.glass ? t.ink : t.muted;
        const icon = tab.icon({ color, filled: on, size: t.glass ? 18 : 24 });
        return (
          <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }}
            onPress={() => onPress(tab.key)} style={[s.fill, { alignItems: 'center', gap: 2, paddingHorizontal: 2 }]}>
            <View collapsable={false} style={{ height: 28, justifyContent: 'center' }}>
              {t.glass ? <GlassTile size={28} tint={on ? t.brand : t.dark ? '#ffffff' : '#c8ccd6'}>{icon}</GlassTile> : icon}
              {tab.badge ? (
                <View style={{ position: 'absolute', top: -2, right: -10, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
                  backgroundColor: '#ff3b30', alignItems: 'center', justifyContent: 'center' }}>
                  <Text fixed style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{tab.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text fixed numberOfLines={1} style={{ fontSize: 12, color, fontWeight: on ? '700' : '500' }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
