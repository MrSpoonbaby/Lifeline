import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { api, CallRow, pretty, siteAddress, when } from './api';
import { s, useTheme } from './theme';
import { Button, Empty, Header, Link } from './ui';

const LABEL: Record<string, string> = {
  completed: '', answered: '', voicemail: 'Voicemail', 'no-answer': 'Missed', busy: 'Missed', canceled: 'Missed', failed: 'Failed', ringing: '',
};

/** Recent calls for the store, and a number pad. */
export function Calls({ onCall, store }: { onCall: (number: string, name: string) => void; store: string }) {
  const t = useTheme();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dialing, setDialing] = useState(false);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCalls((await api<{ calls: CallRow[] }>('/phone/api/calls/')).calls);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    // the customer's name as soon as the number is complete
    setName('');
    if (number.replace(/\D/g, '').length < 10) {
      return;
    }
    const timer = setTimeout(() => {
      api<{ name: string }>(`/phone/api/lookup/?number=${encodeURIComponent(number)}`).then(r => setName(r.name), () => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [number]);

  return (
    <View style={s.fill}>
      <Header title="Calls" sub={store} right={<Link title={dialing ? 'Close' : 'Dial'} onPress={() => setDialing(!dialing)} />} />
      {dialing ? (
        <View style={[s.pad, { gap: 10, backgroundColor: t.card, borderBottomWidth: 1, borderColor: t.line }]}>
          <TextInput
            value={number}
            onChangeText={setNumber}
            placeholder="Phone number"
            placeholderTextColor={t.muted}
            keyboardType="phone-pad"
            autoFocus
            style={[s.input, { color: t.ink, borderColor: t.line, fontSize: 22 }]}
          />
          <Text style={[s.body, { color: name ? t.ink : t.muted }]}>{name || 'Not a customer yet'}</Text>
          <Button title="Call" disabled={number.replace(/\D/g, '').length < 10}
            onPress={() => { onCall(number, name); setDialing(false); setNumber(''); }} />
        </View>
      ) : null}
      {error ? <Text style={[s.small, s.pad, { color: t.danger }]}>{error}</Text> : null}
      <FlatList
        data={calls}
        keyExtractor={c => String(c.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={loading ? null : <Empty text="No calls yet." />}
        renderItem={({ item: c }) => {
          const label = LABEL[c.status] ?? c.status;
          const missed = label === 'Missed' || label === 'Voicemail';
          const detail = [c.incoming ? 'Incoming' : 'Outgoing', label, c.staff, c.seconds && !missed ? `${Math.round(c.seconds / 60) || '<1'} min` : '']
            .filter(Boolean).join(' · ');
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`Call ${c.name || pretty(c.number)}`}
              onPress={() => onCall(c.number, c.name)}
              style={({ pressed }) => [s.item, s.row, { gap: 12, borderColor: t.line, backgroundColor: pressed ? t.soft : t.card }]}>
              <View style={s.fill}>
                <Text style={[s.h2, { color: missed ? t.danger : t.ink }]} numberOfLines={1}>{c.name || pretty(c.number)}</Text>
                <Text style={[s.small, { color: t.muted }]} numberOfLines={1}>{detail}</Text>
              </View>
              {c.voicemail ? <Link title="Play" onPress={() => Linking.openURL(siteAddress() + c.voicemail)} /> : null}
              <Text style={[s.small, { color: t.muted }]}>{when(c.at)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
