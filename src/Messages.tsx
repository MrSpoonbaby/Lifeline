import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { api, pretty, Text as Sms, Thread, when } from './api';
import { s, useTheme } from './theme';
import { Button, Empty, Header, Link } from './ui';

/** Runs `fn` now, every `ms` while the app is on screen, and when it comes back to the front. */
function usePoll(fn: () => void, ms: number) {
  useEffect(() => {
    fn();
    const timer = setInterval(() => AppState.currentState === 'active' && fn(), ms);
    const sub = AppState.addEventListener('change', st => st === 'active' && fn());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [fn, ms]);
}

export type Open = { number: string; name: string; store: number | null };

/** Conversations, newest first. */
export function Messages({ onOpen, store }: { onOpen: (o: Open) => void; store: string }) {
  const t = useTheme();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [number, setNumber] = useState('');

  const refresh = useCallback(async () => {
    try {
      setThreads((await api<{ threads: Thread[] }>('/phone/api/threads/')).threads);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);
  usePoll(refresh, 15000);

  return (
    <View style={s.fill}>
      <Header title="Messages" sub={store} right={<Link title={composing ? 'Close' : 'New'} onPress={() => setComposing(!composing)} />} />
      {composing ? (
        <View style={[s.pad, s.row, { gap: 10, backgroundColor: t.card, borderBottomWidth: 1, borderColor: t.line }]}>
          <TextInput value={number} onChangeText={setNumber} placeholder="Phone number" placeholderTextColor={t.muted}
            keyboardType="phone-pad" autoFocus style={[s.input, s.fill, { color: t.ink, borderColor: t.line }]} />
          <Button title="Text" disabled={number.replace(/\D/g, '').length < 10}
            onPress={() => { onOpen({ number: toE164(number), name: '', store: null }); setComposing(false); setNumber(''); }} />
        </View>
      ) : null}
      {error ? <Text style={[s.small, s.pad, { color: t.danger }]}>{error}</Text> : null}
      <FlatList
        data={threads}
        keyExtractor={th => th.number}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); refresh(); }} />}
        ListEmptyComponent={<Empty text="No texts yet." />}
        renderItem={({ item: th }) => (
          <Pressable accessibilityRole="button" onPress={() => onOpen(th)}
            style={({ pressed }) => [s.item, { borderColor: t.line, backgroundColor: pressed ? t.soft : t.card, gap: 2 }]}>
            <View style={[s.row, { gap: 8 }]}>
              <Text style={[s.h2, s.fill, { color: t.ink }]} numberOfLines={1}>{th.name || pretty(th.number)}</Text>
              <Text style={[s.small, { color: t.muted }]}>{when(th.at)}</Text>
            </View>
            <Text style={[s.body, { color: t.muted }]} numberOfLines={2}>
              {th.incoming ? '' : 'You: '}{th.body}
            </Text>
            {th.store_name ? <Text style={[s.small, { color: t.muted }]}>{th.store_name}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function toE164(number: string) {
  const d = number.replace(/\D/g, '');
  return number.trim().startsWith('+') ? `+${d}` : d.length === 10 ? `+1${d}` : `+${d}`;
}

/** One conversation. Replies go out from the store's number. */
export function Conversation({ open, storeId, onBack, onCall }: {
  open: Open; storeId: number | undefined; onBack: () => void; onCall: (number: string, name: string) => void;
}) {
  const t = useTheme();
  const [texts, setTexts] = useState<Sms[]>([]);
  const [name, setName] = useState(open.name);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<FlatList<Sms>>(null);
  const path = `/phone/api/threads/${encodeURIComponent(open.number)}/`;

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ name: string; texts: Sms[] }>(path);
      setTexts(r.texts);
      setName(r.name || open.name);
    } catch (e: any) {
      setError(e.message);
    }
  }, [path, open.name]);
  usePoll(refresh, 5000);

  const send = async () => {
    setSending(true);
    try {
      const sent = await api<Sms>(path, { body, store: open.store ?? storeId });
      setTexts(ts => [...ts, sent]);
      setBody('');
      setError(sent.ok ? '' : `Not sent: ${sent.error}`);
    } catch (e: any) {
      setError(e.message);
    }
    setSending(false);
  };

  return (
    <KeyboardAvoidingView style={[s.fill, { backgroundColor: t.bg }]} behavior="padding">
      <Header title={name || pretty(open.number)} sub={name ? pretty(open.number) : undefined}
        left={<Link title="‹ Back" onPress={onBack} />} right={<Link title="Call" onPress={() => onCall(open.number, name)} />} />
      <FlatList
        ref={list}
        data={texts}
        keyExtractor={x => String(x.id)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: x }) => (
          <View style={{ alignSelf: x.incoming ? 'flex-start' : 'flex-end', maxWidth: '82%' }}>
            <View style={{ backgroundColor: x.incoming ? t.card : t.brand, borderRadius: 14, padding: 10,
              borderWidth: x.incoming ? 1 : 0, borderColor: t.line }}>
              <Text style={[s.body, { color: x.incoming ? t.ink : t.onBrand }]}>{x.body}</Text>
            </View>
            <Text style={[s.small, { color: x.ok ? t.muted : t.danger, alignSelf: x.incoming ? 'flex-start' : 'flex-end' }]}>
              {when(x.at)}{x.by ? ` · ${x.by}` : ''}{x.ok ? '' : ' · not sent'}
            </Text>
          </View>
        )}
      />
      {error ? <Text style={[s.small, { color: t.danger, paddingHorizontal: 12 }]}>{error}</Text> : null}
      <View style={[s.row, { gap: 8, padding: 10, borderTopWidth: 1, borderColor: t.line, backgroundColor: t.card }]}>
        <TextInput value={body} onChangeText={setBody} placeholder="Text message" placeholderTextColor={t.muted} multiline
          style={[s.input, s.fill, { color: t.ink, borderColor: t.line, maxHeight: 120 }]} />
        <Button title="Send" onPress={send} disabled={sending || !body.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}
