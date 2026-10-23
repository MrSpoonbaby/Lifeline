import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { api, CallRow, pretty, when } from './api';
import { s, useTheme } from './theme';
import { Empty, Header, Text } from './ui';

const LABEL: Record<string, string> = {
  completed: '', answered: '', voicemail: 'Voicemail', 'no-answer': 'Missed', busy: 'Missed', canceled: 'Missed', failed: 'Failed', ringing: '',
};

/** Recent calls for the store. Tap one to call back. */
export function Calls({ onCall }: { onCall: (number: string, name: string) => void }) {
  const t = useTheme();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <View style={s.fill}>
      <Header title="Recents" />
      {error ? <Text style={[s.small, s.pad, { color: t.danger }]}>{error}</Text> : null}
      <FlatList
        contentContainerStyle={s.list}
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
              <Text style={[s.small, { color: t.muted }]}>{when(c.at)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
