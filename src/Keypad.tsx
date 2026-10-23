/** The keypad: round keys with their letters, a big number that formats as you type, and a round call button. */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from './api';
import { BackspaceIcon, PhoneIcon } from './icons';
import { s, useTheme } from './theme';
import { Text } from './ui';

const KEYS: [string, string][] = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];
const SIZE = 78; // key diameter

/** The 3×4 grid of keys. Holding 0 types "+", like a phone. */
export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: SIZE * 3 + 28 * 2, gap: 14, columnGap: 28 }}>
      {KEYS.map(([digit, letters]) => (
        <Pressable key={digit} accessibilityRole="button" accessibilityLabel={digit}
          onPress={() => onKey(digit)} onLongPress={digit === '0' ? () => onKey('+') : undefined}
          style={({ pressed }) => ({ width: SIZE, height: SIZE, borderRadius: SIZE / 2,
            alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.keyPressed : t.key })}>
          <Text style={{ fontSize: digit === '*' ? 40 : 34, lineHeight: digit === '*' ? 44 : 38, color: t.ink,
            fontWeight: '400' }}>{digit}</Text>
          {letters ? (
            <Text style={{ fontSize: 10, letterSpacing: 2, marginTop: -2, color: t.ink, fontWeight: '700' }}>{letters}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** How a phone shows a number while it's typed: 555-1234, (555) 123-4567, 1 (555) 123-4567. */
export function asTyped(raw: string) {
  const d = raw.replace(/[^\d]/g, '');
  if (/[*#+]/.test(raw)) {
    return raw;
  }
  const us = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  const lead = us === d ? '' : '1 ';
  if (us.length <= 3 || us.length > 10) {
    return raw;
  }
  if (us.length <= 7 && !lead) {
    return `${us.slice(0, 3)}-${us.slice(3)}`;
  }
  return `${lead}(${us.slice(0, 3)}) ${us.slice(3, 6)}${us.length > 6 ? '-' : ''}${us.slice(6)}`;
}

/** The Keypad tab. */
export function DialPad({ onCall }: { onCall: (number: string, name: string) => void }) {
  const t = useTheme();
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const digits = number.replace(/\D/g, '');

  useEffect(() => {
    // the customer's name once the number is complete
    setName('');
    if (digits.length < 10) {
      return;
    }
    const timer = setTimeout(() => {
      api<{ name: string }>(`/phone/api/lookup/?number=${encodeURIComponent(number)}`).then(r => setName(r.name), () => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [number, digits.length]);

  const call = () => {
    if (digits.length >= 10) {
      onCall(number, name);
      setNumber('');
    }
  };

  return (
    <View style={[s.fill, { alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 28 }]}>
      <View style={{ alignItems: 'center', gap: 6, minHeight: 110, justifyContent: 'flex-end', paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 38, color: t.ink, fontWeight: '400' }} numberOfLines={1} adjustsFontSizeToFit>{asTyped(number)}</Text>
        <Text style={[s.body, { color: name ? t.brand : t.muted, minHeight: 20 }]} numberOfLines={1}>
          {name || (digits.length >= 10 ? 'Not a customer yet' : '')}
        </Text>
      </View>
      <Keypad onKey={k => setNumber(n => n + k)} />
      <View style={{ width: SIZE * 3 + 28 * 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: SIZE }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Call" onPress={call}
          style={({ pressed }) => ({ width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center',
            backgroundColor: t.call, opacity: pressed ? 0.75 : 1 })}>
          <PhoneIcon size={34} color="#ffffff" />
        </Pressable>
        <View style={{ width: SIZE, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Delete" accessibilityHint="Hold to clear the number" hitSlop={16}
            disabled={!number} onPress={() => setNumber(n => n.slice(0, -1))} onLongPress={() => setNumber('')}
            style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? t.keyPressed : 'transparent', opacity: number ? 1 : 0.3 })}>
            <BackspaceIcon color={t.ink} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
