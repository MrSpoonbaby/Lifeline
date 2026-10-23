/** Which store you call and text from. Like the shop website's top bar: people with one store just see its name; people
 *  with several get a store button that opens a list, so it can't be changed by a stray tap. */
import React, { createContext, useContext, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { pretty, Store } from './api';
import { s, useTheme } from './theme';
import { Text } from './ui';

type Stores = { stores: Store[]; current: Store | undefined; pick: (id: number) => void };
export const StoreContext = createContext<Stores>({ stores: [], current: undefined, pick: () => {} });

function StoreIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6" />
    </Svg>
  );
}

export function StoreChip() {
  const t = useTheme();
  const { stores, current, pick } = useContext(StoreContext);
  const [open, setOpen] = useState(false);
  if (!current) {
    return null;
  }
  const many = stores.length > 1;
  const chip = (
    <View style={[s.row, { gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, borderColor: t.line,
      backgroundColor: t.card }]}>
      <StoreIcon color={t.muted} />
      <Text style={{ color: t.ink, fontSize: 14, fontWeight: '600', maxWidth: 140 }} numberOfLines={1}>{current.name}</Text>
      {many ? <Text style={{ color: t.muted, fontSize: 12 }}>▾</Text> : null}
    </View>
  );
  if (!many) {
    return <View accessible accessibilityLabel={`Your store: ${current.name}`}>{chip}</View>;
  }
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Store: ${current.name}. Change store`} onPress={() => setOpen(true)} hitSlop={6}>
        {chip}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: t.dark ? '#1c1c1e' : '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 8, paddingBottom: 24 }}>
            <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: t.line, marginBottom: 8 }} />
            <Text style={[s.h2, { color: t.ink, paddingHorizontal: 20, paddingVertical: 10 }]}>Call and text from</Text>
            {stores.map(store => {
              const on = store.id === current.id;
              return (
                <Pressable key={store.id} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  onPress={() => { pick(store.id); setOpen(false); }}
                  style={({ pressed }) => [s.row, { paddingHorizontal: 20, paddingVertical: 14, gap: 12, backgroundColor: pressed ? t.soft : 'transparent' }]}>
                  <StoreIcon color={on ? t.brand : t.muted} />
                  <View style={s.fill}>
                    <Text style={{ color: t.ink, fontSize: 16, fontWeight: on ? '700' : '500' }}>{store.name}</Text>
                    <Text style={[s.small, { color: t.muted }]}>{pretty(store.number)}</Text>
                  </View>
                  {on ? <Text style={{ color: t.brand, fontSize: 18, fontWeight: '700' }}>✓</Text> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
