import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AudioDevice, Call, CallInvite } from '@twilio/voice-react-native-sdk';
import { voice } from './calling';
import { pretty } from './api';
import { s, useTheme } from './theme';
import { Button } from './ui';

export type Caller = { number: string; name: string; store: string };

/** A call ringing in while the app is open. The lock-screen version is Twilio's own notification. */
export function Ringing({ invite, caller }: { invite: CallInvite; caller: Caller }) {
  const t = useTheme();
  return (
    <View style={[s.fill, s.pad, { justifyContent: 'space-between', backgroundColor: t.bg }]}>
      <View style={{ alignItems: 'center', marginTop: 80, gap: 8 }}>
        <Text style={[s.small, { color: t.muted }]}>Incoming call{caller.store ? ` · ${caller.store}` : ''}</Text>
        <Text style={[s.h1, { color: t.ink, fontSize: 30 }]}>{caller.name || pretty(caller.number)}</Text>
        {caller.name ? <Text style={[s.body, { color: t.muted }]}>{pretty(caller.number)}</Text> : null}
      </View>
      <View style={[s.row, { gap: 16, marginBottom: 40 }]}>
        <Button title="Decline" kind="danger" style={s.fill} onPress={() => invite.reject()} />
        <Button title="Answer" style={s.fill} onPress={() => invite.accept()} />
      </View>
    </View>
  );
}

export function InCall({ call, caller }: { call: Call; caller: Caller }) {
  const t = useTheme();
  const [state, setState] = useState(call.getState());
  const [muted, setMuted] = useState(Boolean(call.isMuted()));
  const [speaker, setSpeaker] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [digits, setDigits] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    const update = () => setState(call.getState());
    const events = [Call.Event.Connected, Call.Event.Ringing, Call.Event.Reconnecting, Call.Event.Reconnected, Call.Event.Disconnected];
    events.forEach(e => call.on(e, update));
    const timer = setInterval(() => tick(n => n + 1), 1000);
    return () => {
      events.forEach(e => call.off(e, update));
      clearInterval(timer);
    };
  }, [call]);

  const toggleSpeaker = async () => {
    const { audioDevices } = await voice.getAudioDevices();
    const want = speaker ? AudioDevice.Type.Earpiece : AudioDevice.Type.Speaker;
    const device = audioDevices.find(d => d.type === want);
    if (device) {
      await device.select();
      setSpeaker(!speaker);
    }
  };

  const started = call.getInitialConnectedTimestamp();
  const secs = started ? Math.floor((Date.now() - started.getTime()) / 1000) : 0;
  const status = state === Call.State.Connected
    ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
    : state === Call.State.Reconnecting ? 'Reconnecting…' : state === Call.State.Ringing ? 'Ringing…' : 'Connecting…';

  const key = (k: string) => {
    call.sendDigits(k);
    setDigits(d => d + k);
  };

  return (
    <View style={[s.fill, s.pad, { justifyContent: 'space-between', backgroundColor: t.bg }]}>
      <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
        <Text style={[s.h1, { color: t.ink, fontSize: 30 }]}>{caller.name || pretty(caller.number)}</Text>
        {caller.name ? <Text style={[s.body, { color: t.muted }]}>{pretty(caller.number)}</Text> : null}
        <Text style={[s.body, { color: t.muted }]}>{status}{caller.store ? ` · ${caller.store}` : ''}</Text>
        {keypad && digits ? <Text style={[s.h2, { color: t.ink, letterSpacing: 2 }]}>{digits}</Text> : null}
      </View>
      {keypad ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={`Key ${k}`} onPress={() => key(k)}
              style={({ pressed }) => [{ width: '28%', paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                backgroundColor: pressed ? t.soft : t.card, borderWidth: 1, borderColor: t.line }]}>
              <Text style={[s.h1, { color: t.ink }]}>{k}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ gap: 12, marginBottom: 40 }}>
        <View style={[s.row, { gap: 12 }]}>
          <Button title={muted ? 'Unmute' : 'Mute'} kind={muted ? 'brand' : 'plain'} style={s.fill}
            onPress={async () => setMuted(await call.mute(!muted))} />
          <Button title="Speaker" kind={speaker ? 'brand' : 'plain'} style={s.fill} onPress={toggleSpeaker} />
          <Button title="Keypad" kind={keypad ? 'brand' : 'plain'} style={s.fill} onPress={() => setKeypad(!keypad)} />
        </View>
        <Button title="Hang up" kind="danger" onPress={() => call.disconnect()} />
      </View>
    </View>
  );
}
