import React from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { helpers, Me, siteAddress } from './api';
import { StoreChip } from './stores';
import { ACCENT_SWATCHES, BACKGROUNDS, FONT_CHOICES, Gradient, GRADIENTS, LEVELS, MODES, s, TabKey, TEXT_SIZES, usePrefs, useTheme } from './theme';
import { Button, Choice, Header, Link, Text } from './ui';

type Props = {
  me: Me | null;
  away: boolean;
  onAway: (away: boolean) => void;
  tabLabels: Record<TabKey, string>;
  onSignOut: () => void;
  onBack: () => void;
  simulator: React.ReactNode; // the simulator's buttons, local testing only
};

export function Settings({ me, away, onAway, tabLabels, onSignOut, onBack, simulator }: Props) {
  const t = useTheme();
  const prefs = usePrefs();
  const section = { gap: 12, padding: 16, borderRadius: 22, backgroundColor: t.card, borderWidth: 1, borderColor: t.line };
  const label = [s.small, { color: t.muted, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 }];
  const heading = [s.body, { color: t.ink, fontWeight: '600' as const }];

  const move = (i: number, by: number) => {
    const tabs = [...prefs.tabs];
    [tabs[i], tabs[i + by]] = [tabs[i + by], tabs[i]];
    prefs.set('tabs', tabs);
  };

  return (
    <View style={s.fill}>
      <Header title="Settings" sub={me?.name} left={<Link title="‹ Back" onPress={onBack} />} />
      <ScrollView contentContainerStyle={[s.pad, { gap: 20, paddingBottom: 40 }]}>
        <View style={{ gap: 8 }}>
          <Text style={label}>Status</Text>
          <View style={section}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={heading}>Store</Text>
              <StoreChip />
            </View>
            <Choice options={[['in', 'In store'], ['out', 'Out of store']]} value={away ? 'out' : 'in'} onChange={v => onAway(v === 'out')} />
            <Text style={[s.small, { color: t.muted }]}>
              {away
                ? "Store calls don't ring your phones and texts and voicemail don't alert you. They still show up here when you look."
                : 'Your phones ring for store calls and alert you to texts and voicemail.'}
            </Text>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={label}>Appearance</Text>
          <View style={section}>
            <Text style={heading}>Light or dark</Text>
            <Choice options={MODES} value={prefs.mode} onChange={v => prefs.set('mode', v)} />
            <Text style={[heading, { marginTop: 4 }]}>Color</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {prefs.phoneAccent ? (
                <Swatch on={prefs.accent === 'phone'} label="Your phone's color" onPress={() => prefs.set('accent', 'phone')}
                  fill={t.dark ? prefs.phoneAccent.dark : prefs.phoneAccent.light} text="Phone" />
              ) : null}
              <Swatch on={prefs.accent === 'default'} label="Tech ResQ green" onPress={() => prefs.set('accent', 'default')} text="Auto" />
              {ACCENT_SWATCHES.map(([key, color]) => (
                <Swatch key={key} on={prefs.accent === key} label={key} fill={color} onPress={() => prefs.set('accent', key)} />
              ))}
            </View>
            {prefs.accent === 'phone' ? <Text style={[s.small, { color: t.muted }]}>Matches your phone's wallpaper colors.</Text> : null}
            <Text style={[heading, { marginTop: 4 }]}>Font</Text>
            <Choice options={FONT_CHOICES} value={prefs.font} onChange={v => prefs.set('font', v)} />
            <Text style={[heading, { marginTop: 4 }]}>Text size</Text>
            <Choice options={TEXT_SIZES} value={prefs.textSize} onChange={v => prefs.set('textSize', v)} />
            <Text style={[heading, { marginTop: 4 }]}>Glass</Text>
            <Choice options={[['off', 'Solid'], ['on', 'Glass']]} value={prefs.glass ? 'on' : 'off'} onChange={v => prefs.set('glass', v === 'on')} />
            <Text style={[s.small, { color: t.muted }]}>Glass: see-through panels, a floating tab bar, and icons on glass tiles.</Text>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={label}>Background</Text>
          <View style={section}>
            <Choice options={BACKGROUNDS} value={prefs.background} onChange={v => prefs.set('background', v)} />
            {prefs.background === 'gradient' ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {(Object.entries(GRADIENTS) as [Gradient, [string, string] | null][]).map(([key, colors]) => (
                    <Swatch key={key} on={prefs.gradient === key} label={`${key} gradient`} onPress={() => prefs.set('gradient', key)}
                      fill={(colors ?? [t.brand])[0]} fill2={(colors ?? [t.brand, t.call])[1]} />
                  ))}
                </View>
                <Text style={[s.small, { color: t.muted }]}>
                  {prefs.gradient === 'accent' ? 'Your color' : prefs.gradient[0].toUpperCase() + prefs.gradient.slice(1)}
                </Text>
                <Text style={heading}>Strength</Text>
                <Choice options={LEVELS} value={prefs.strength} onChange={v => prefs.set('strength', v)} />
              </>
            ) : null}
            {prefs.background === 'photo' ? (
              <>
                {prefs.photo ? (
                  <Image source={{ uri: prefs.photo }} style={{ height: 140, borderRadius: 16 }} resizeMode="cover"
                    blurRadius={{ off: 0, low: 6, mid: 14, high: 28 }[prefs.blur]} accessibilityLabel="Your background photo" />
                ) : (
                  <Text style={[s.small, { color: t.muted }]}>Pick a photo from this phone. It stays on this phone, just for you.</Text>
                )}
                <View style={[s.row, { gap: 10 }]}>
                  <Button title={prefs.photo ? 'Change photo' : 'Choose photo'} style={s.fill}
                    onPress={() => helpers.pickImage().then(uri => uri && prefs.set('photo', uri), e => Alert.alert('Photo', e.message))} />
                  {prefs.photo ? (
                    <Button title="Remove" kind="plain" onPress={() => helpers.clearImage().then(() => prefs.set('photo', ''))} />
                  ) : null}
                </View>
                {prefs.photo ? (
                  <>
                    <Text style={heading}>Dim (keeps text readable)</Text>
                    <Choice options={LEVELS} value={prefs.dim} onChange={v => prefs.set('dim', v)} />
                    <Text style={heading}>Blur</Text>
                    <Choice options={[['off', 'Off'], ...LEVELS]} value={prefs.blur} onChange={v => prefs.set('blur', v)} />
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={label}>Tabs</Text>
          <View style={[section, { gap: 0, paddingVertical: 4 }]}>
            {prefs.tabs.map((key, i) => (
              <View key={key} style={[s.row, { paddingVertical: 8, gap: 10, borderTopWidth: i ? 1 : 0, borderColor: t.line }]}>
                <Text style={[s.small, { color: t.muted, width: 18 }]}>{i + 1}</Text>
                <Text style={[s.body, s.fill, { color: t.ink }]}>{tabLabels[key]}{i === 0 ? '  · opens first' : ''}</Text>
                <Arrow label={`Move ${tabLabels[key]} up`} glyph="▲" disabled={i === 0} onPress={() => move(i, -1)} />
                <Arrow label={`Move ${tabLabels[key]} down`} glyph="▼" disabled={i === prefs.tabs.length - 1} onPress={() => move(i, 1)} />
              </View>
            ))}
          </View>
        </View>

        {simulator}

        <View style={{ gap: 8 }}>
          <Text style={[s.small, { color: t.muted }]}>Signed in to {siteAddress()}</Text>
          <Button title="Sign out" kind="plain" onPress={onSignOut} />
        </View>
      </ScrollView>
    </View>
  );
}

function Arrow({ label, glyph, disabled, onPress }: { label: string; glyph: string; disabled: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={6}
      style={({ pressed }) => ({ width: 40, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? t.soft : 'transparent', opacity: disabled ? 0.25 : 1 })}>
      <Text style={{ color: t.brand, fontSize: 14 }}>{glyph}</Text>
    </Pressable>
  );
}

/** A round color choice: one color, two (a gradient), or a word on a plain circle. */
function Swatch({ on, label, onPress, fill, fill2, text }: {
  on: boolean; label: string; onPress: () => void; fill?: string; fill2?: string; text?: string;
}) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
        borderWidth: on ? 3 : 1, borderColor: on ? t.ink : t.line, backgroundColor: fill || 'transparent' }}>
      {fill2 ? (
        <Svg style={{ position: 'absolute' }} width={44} height={44}>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={fill} />
              <Stop offset="1" stopColor={fill2} />
            </LinearGradient>
          </Defs>
          <Rect width={44} height={44} fill="url(#g)" />
        </Svg>
      ) : null}
      {text ? <Text fixed style={{ color: fill ? '#fff' : t.ink, fontSize: 10, fontWeight: '700' }}>{text}</Text>
        : on ? <Text fixed style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✓</Text> : null}
    </Pressable>
  );
}
