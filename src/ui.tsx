import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { s, useTheme } from './theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  kind?: 'brand' | 'danger' | 'plain';
  disabled?: boolean;
  style?: object;
};

export function Button({ title, onPress, kind = 'brand', disabled, style }: ButtonProps) {
  const t = useTheme();
  const bg = { brand: t.brand, danger: t.danger, plain: t.card }[kind];
  const fg = { brand: t.onBrand, danger: t.onDanger, plain: t.ink }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        kind === 'plain' && { borderWidth: 1, borderColor: t.line },
        style,
      ]}>
      <Text style={[s.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** A screen's title bar, with an optional action on the right. */
export function Header({ title, sub, left, right }: { title: string; sub?: string; left?: React.ReactNode; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[s.row, { paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderColor: t.line, backgroundColor: t.card }]}>
      {left}
      <View style={s.fill}>
        <Text style={[s.h1, { color: t.ink }]} numberOfLines={1}>{title}</Text>
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
      <Text style={[s.body, { color: t.brand, fontWeight: '600' }]}>{title}</Text>
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  const t = useTheme();
  return <Text style={[s.body, { color: t.muted, textAlign: 'center', padding: 32 }]}>{text}</Text>;
}
