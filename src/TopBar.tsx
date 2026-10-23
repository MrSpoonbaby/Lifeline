/** The bar across the top: the company logo, and the person's picture (their Google photo, else initials) with a dot for
 *  their status. Tapping the picture opens a quick menu: In store / Out of store, and Settings. */
import React, { useContext, useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { Me } from './api';
import { SettingsIcon } from './icons';
import { StoreContext } from './stores';
import { s, useTheme } from './theme';
import { Choice, Text } from './ui';

const logo = require('./assets/logo.png');
const logoWhite = require('./assets/logo-white.png');

export function Avatar({ me, size }: { me: Me; size: number }) {
  const t = useTheme();
  const [broken, setBroken] = useState(false);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: t.brand,
      alignItems: 'center', justifyContent: 'center' }}>
      {me.avatar_url && !broken ? (
        <Image source={{ uri: me.avatar_url }} style={{ width: size, height: size }} onError={() => setBroken(true)} />
      ) : (
        <Text fixed style={{ color: t.onBrand, fontSize: size * 0.4, fontWeight: '700' }}>{me.initials}</Text>
      )}
    </View>
  );
}

export function TopBar({ me, away, onAway, onSettings }: {
  me: Me; away: boolean; onAway: (away: boolean) => void; onSettings: () => void;
}) {
  const t = useTheme();
  const { current } = useContext(StoreContext);
  const [open, setOpen] = useState(false);
  const statusDot = (size: number) => (
    <View style={{ position: 'absolute', right: -1, bottom: -1, width: size, height: size, borderRadius: size / 2, borderWidth: 2,
      borderColor: t.glass ? '#ffffff' : t.card, backgroundColor: away ? '#f59e0b' : '#22c55e' }} />
  );
  return (
    <View style={[s.row, { justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }]}>
      <Image source={t.dark ? logoWhite : logo} style={{ width: 70, height: 36 }} resizeMode="contain" accessibilityLabel="Tech ResQ" />
      <Pressable accessibilityRole="button" accessibilityLabel={`${me.name}, ${away ? 'out of store' : 'in store'}. Open menu`}
        onPress={() => setOpen(true)} hitSlop={8}>
        <Avatar me={me} size={36} />
        {statusDot(12)}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} onPress={() => setOpen(false)}>
          <Pressable style={{ position: 'absolute', top: 64, right: 12, width: 280, borderRadius: 24, padding: 16, gap: 14,
            backgroundColor: t.dark ? '#1f2421' : '#ffffff', elevation: 12 }}>
            <View style={[s.row, { gap: 12 }]}>
              <View>
                <Avatar me={me} size={48} />
                {statusDot(14)}
              </View>
              <View style={s.fill}>
                <Text style={[s.h2, { color: t.ink }]} numberOfLines={1}>{me.name}</Text>
                <Text style={[s.small, { color: t.muted }]} numberOfLines={1}>
                  {[current?.name, away ? 'Out of store' : 'In store'].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            <Choice options={[['in', 'In store'], ['out', 'Out of store']]} value={away ? 'out' : 'in'} onChange={v => onAway(v === 'out')} />
            <Pressable accessibilityRole="button" onPress={() => { setOpen(false); onSettings(); }}
              style={({ pressed }) => [s.row, { gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14,
                backgroundColor: pressed ? t.soft : 'transparent' }]}>
              <SettingsIcon color={t.ink} size={22} />
              <Text style={[s.body, { color: t.ink, fontWeight: '600' }]}>Settings</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
