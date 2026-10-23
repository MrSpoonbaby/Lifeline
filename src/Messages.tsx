import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { api, pretty, Text as Sms, Thread, when } from './api';
import { s, useTheme } from './theme';
import { Button, Empty, Header, Link, Text, TextInput } from './ui';

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

/** A label on a number that isn't a customer's (a supplier...). */
function LabelTag({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: t.soft }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: t.brand }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** A filter or suggestion you tap. */
function Chip({ title, on, onPress }: { title: string; on?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} hitSlop={4}
      style={{ paddingHorizontal: 14, height: 32, justifyContent: 'center', borderRadius: 16, borderWidth: 1,
        borderColor: on ? t.brand : t.line, backgroundColor: on ? t.brand : t.card }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: on ? t.onBrand : t.ink }}>{title}</Text>
    </Pressable>
  );
}

let lastShow = ''; // the Show filter, kept while a conversation is open: '' customers, 'all', or one label

/** Conversations, newest first. Customers' by default; labelled numbers (a supplier...) under their label or Everything. */
export function Messages({ onOpen }: { onOpen: (o: Open) => void }) {
  const t = useTheme();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [show, setShowState] = useState(lastShow);
  const setShow = (v: string) => {
    lastShow = v;
    setShowState(v);
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [number, setNumber] = useState('');

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ threads: Thread[]; labels: string[] }>('/phone/api/threads/');
      setThreads(r.threads);
      setLabels(r.labels ?? []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);
  usePoll(refresh, 15000);
  const shown = threads.filter(th => (show === 'all' ? true : show ? th.label === show : !th.label));
  const hidden = show ? 0 : threads.length - shown.length;

  return (
    <View style={s.fill}>
      <Header title="Messages" right={<Link title={composing ? 'Close' : 'New'} onPress={() => setComposing(!composing)} />} />
      {composing ? (
        <View style={[s.pad, s.row, { gap: 10, margin: 12, marginBottom: 0, borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }]}>
          <TextInput value={number} onChangeText={setNumber} placeholder="Phone number" placeholderTextColor={t.muted}
            keyboardType="phone-pad" autoFocus style={[s.input, s.fill, { color: t.ink, borderColor: t.line }]} />
          <Button title="Text" disabled={number.replace(/\D/g, '').length < 10}
            onPress={() => { onOpen({ number: toE164(number), name: '', store: null }); setComposing(false); setNumber(''); }} />
        </View>
      ) : null}
      {labels.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
          <Chip title="Customers" on={!show} onPress={() => setShow('')} />
          <Chip title="Everything" on={show === 'all'} onPress={() => setShow('all')} />
          {labels.map(l => <Chip key={l} title={l} on={show === l} onPress={() => setShow(l)} />)}
          {hidden ? <Text style={[s.small, { color: t.muted }]}>{hidden} labelled hidden</Text> : null}
        </ScrollView>
      ) : null}
      {error ? <Text style={[s.small, s.pad, { color: t.danger }]}>{error}</Text> : null}
      <FlatList
        contentContainerStyle={s.list}
        data={shown}
        keyExtractor={th => th.number}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); refresh(); }} />}
        ListEmptyComponent={<Empty text={show ? 'Nothing here.' : 'No texts yet.'} />}
        renderItem={({ item: th }) => (
          <Pressable accessibilityRole="button" onPress={() => onOpen(th)}
            style={({ pressed }) => [s.item, { borderColor: t.line, backgroundColor: pressed ? t.soft : t.card, gap: 2 }]}>
            <View style={[s.row, { gap: 8 }]}>
              <Text style={[s.h2, s.fill, { color: t.ink }]} numberOfLines={1}>{th.name || pretty(th.number)}</Text>
              {th.label ? <LabelTag label={th.label} /> : null}
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
  const [label, setLabel] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelling, setLabelling] = useState(false);
  const [draft, setDraft] = useState('');
  const list = useRef<FlatList<Sms>>(null);
  const path = `/phone/api/threads/${encodeURIComponent(open.number)}/`;

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ name: string; texts: Sms[]; label: string; labels: string[] }>(path);
      setTexts(r.texts);
      setName(r.name || open.name);
      setLabel(r.label ?? '');
      setLabels(r.labels ?? []);
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

  /** Not a customer (a supplier...): label the number so its texts leave the customer list, here and on the website. */
  const saveLabel = async (value: string) => {
    try {
      setLabel((await api<{ label: string }>(`${path}label/`, { label: value })).label);
      setLabelling(false);
      setDraft('');
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <KeyboardAvoidingView style={[s.fill, { backgroundColor: t.bg }]} behavior="padding">
      <Header title={name || pretty(open.number)} sub={name ? pretty(open.number) : undefined}
        left={<Link title="‹ Back" onPress={onBack} />} right={<Link title="Call" onPress={() => onCall(open.number, name)} />} />
      <View style={[s.row, { gap: 10, paddingHorizontal: 16, paddingBottom: 6 }]}>
        {label ? (
          <>
            <LabelTag label={label} />
            <Link title="Remove label" onPress={() => saveLabel('')} />
          </>
        ) : (
          <Link title={labelling ? 'Cancel' : 'Not a customer?'} onPress={() => setLabelling(!labelling)} />
        )}
      </View>
      {labelling && !label ? (
        <View style={[s.pad, { gap: 8, marginHorizontal: 12, borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }]}>
          <Text style={[s.small, { color: t.muted }]}>Label this number, e.g. Supplier. Its texts leave the customer list.</Text>
          {labels.length ? (
            <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
              {labels.map(l => <Chip key={l} title={l} onPress={() => saveLabel(l)} />)}
            </View>
          ) : null}
          <View style={[s.row, { gap: 8 }]}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="New label" placeholderTextColor={t.muted} maxLength={60}
              style={[s.input, s.fill, { color: t.ink, borderColor: t.line }]} />
            <Button title="Save" onPress={() => saveLabel(draft)} disabled={!draft.trim()} />
          </View>
        </View>
      ) : null}
      <FlatList
        ref={list}
        data={texts}
        keyExtractor={x => String(x.id)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: x }) => (
          <View style={{ alignSelf: x.incoming ? 'flex-start' : 'flex-end', maxWidth: '82%' }}>
            <View style={{ backgroundColor: x.incoming ? t.bubbleIn : t.bubbleOut, borderRadius: 18,
              paddingHorizontal: 12, paddingVertical: 8, borderWidth: x.incoming ? 1 : 0, borderColor: t.line }}>
              <Text style={[s.body, { color: x.incoming ? t.onBubbleIn : t.onBubbleOut, fontSize: 16 }]}>{x.body}</Text>
            </View>
            <Text style={[s.small, { color: x.ok ? t.muted : t.danger, alignSelf: x.incoming ? 'flex-start' : 'flex-end' }]}>
              {when(x.at)}{x.by ? ` · ${x.by}` : ''}{x.ok ? '' : ' · not sent'}
            </Text>
          </View>
        )}
      />
      {error ? <Text style={[s.small, { color: t.danger, paddingHorizontal: 12 }]}>{error}</Text> : null}
      <View style={[s.row, { gap: 8, padding: 10, margin: 10, borderRadius: 26, borderWidth: 1, borderColor: t.line, backgroundColor: t.card }]}>
        <TextInput value={body} onChangeText={setBody} placeholder="Text message" placeholderTextColor={t.muted} multiline
          style={[s.input, s.fill, { color: t.ink, borderColor: t.line, maxHeight: 120 }]} />
        <Button title="Send" onPress={send} disabled={sending || !body.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}
