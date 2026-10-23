import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { api, CallRow, helpers, pretty, siteAddress, when } from './api';
import { PauseIcon, PhoneIcon, PlayIcon } from './icons';
import { s, useTheme } from './theme';
import { Empty, Header, Text } from './ui';

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/** The store's voicemails, newest first. New ones have a dot until someone at the store plays them. */
export function Voicemail({ onCall, onSeen }: { onCall: (number: string, name: string) => void; onSeen: () => void }) {
  const t = useTheme();
  const [items, setItems] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { calls } = await api<{ calls: CallRow[] }>('/phone/api/calls/');
      setItems(calls.filter(c => c.voicemail));
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => AppState.currentState === 'active' && refresh(), 30000);
    return () => {
      clearInterval(timer);
      helpers.stop();
    };
  }, [refresh]);

  const played = (id: number) => {
    setItems(list => list.map(v => (v.id === id ? { ...v, heard: true } : v)));
    api(`/phone/api/calls/${id}/heard/`, {}).then(onSeen, () => {});
  };

  return (
    <View style={s.fill}>
      <Header title="Voicemail" />
      {error ? <Text style={[s.small, s.pad, { color: t.danger }]}>{error}</Text> : null}
      <FlatList
        contentContainerStyle={s.list}
        data={items}
        keyExtractor={v => String(v.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); refresh(); }} />}
        ListEmptyComponent={<Empty text="No voicemail." />}
        renderItem={({ item: v }) => (
          <View style={[s.item, { borderColor: t.line, backgroundColor: open === v.id ? t.soft : t.card }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Voicemail from ${v.name || pretty(v.number)}`}
              onPress={() => { helpers.stop(); setOpen(open === v.id ? null : v.id); }} style={[s.row, { gap: 10 }]}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: v.heard ? 'transparent' : t.brand }} />
              <View style={s.fill}>
                <Text style={[s.h2, { color: t.ink, fontWeight: v.heard ? '500' : '700' }]} numberOfLines={1}>{v.name || pretty(v.number)}</Text>
                <Text style={[s.small, { color: t.muted }]}>{[v.name ? pretty(v.number) : '', v.store_name].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.small, { color: t.muted }]}>{when(v.at)}</Text>
                <Text style={[s.small, { color: t.muted }]}>{clock(v.seconds * 1000)}</Text>
              </View>
            </Pressable>
            {open === v.id ? <Player item={v} onPlayed={() => played(v.id)} onCall={onCall} /> : null}
          </View>
        )}
      />
    </View>
  );
}

/** Play / pause, a progress bar you can tap to jump, and call back. Plays through the phone's speaker. */
function Player({ item, onPlayed, onCall }: { item: CallRow; onPlayed: () => void; onCall: (number: string, name: string) => void }) {
  const t = useTheme();
  const [state, setState] = useState<{ position: number; duration: number; playing: boolean }>({
    position: 0, duration: item.seconds * 1000, playing: false });
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState('');
  const width = useRef(1);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    const timer = setInterval(async () => {
      const now = await helpers.playback();
      if (now) {
        setState(now);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [loaded]);

  const toggle = async () => {
    setProblem('');
    try {
      if (!loaded) {
        await helpers.play(siteAddress() + item.voicemail);
        setLoaded(true);
        if (!item.heard) {
          onPlayed();
        }
      } else if (state.playing) {
        await helpers.pause();
      } else {
        if (state.position >= state.duration - 300) {
          await helpers.seek(0);
        }
        await helpers.resume();
      }
    } catch (e: any) {
      setProblem(e.message);
    }
  };

  const progress = state.duration ? Math.min(1, state.position / state.duration) : 0;
  return (
    <View style={{ gap: 10, paddingTop: 12, paddingLeft: 20 }}>
      <Pressable accessibilityRole="adjustable" accessibilityLabel="Playback position" hitSlop={10}
        onLayout={e => { width.current = e.nativeEvent.layout.width || 1; }}
        onPress={e => loaded && helpers.seek((e.nativeEvent.locationX / width.current) * state.duration)}
        style={{ height: 4, borderRadius: 2, backgroundColor: t.line }}>
        <View style={{ width: `${progress * 100}%`, height: 4, borderRadius: 2, backgroundColor: t.brand }} />
      </Pressable>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={[s.small, { color: t.muted }]}>{clock(state.position)}</Text>
        <Text style={[s.small, { color: t.muted }]}>-{clock(Math.max(0, state.duration - state.position))}</Text>
      </View>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={state.playing ? 'Pause' : 'Play'} onPress={toggle}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.brand, alignItems: 'center', justifyContent: 'center' }}>
          {state.playing ? <PauseIcon color={t.onBrand} /> : <PlayIcon color={t.onBrand} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Call back" onPress={() => onCall(item.number, item.name)}
          style={[s.row, { gap: 8, paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: t.call }]}>
          <PhoneIcon size={18} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }}>Call back</Text>
        </Pressable>
      </View>
      {problem ? <Text style={[s.small, { color: t.danger }]}>{problem}</Text> : null}
    </View>
  );
}
