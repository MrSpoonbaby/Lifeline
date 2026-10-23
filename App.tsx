/** Tech ResQ Phone: the store's business line on staff phones. See docs/design.md. */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Call, CallInvite, Voice } from '@twilio/voice-react-native-sdk';
import { api, finishSignIn, forget, helpers, load, Me, siteAddress, SignedOut } from './src/api';
import { dial, register, unregister, voice } from './src/calling';
import { Calls } from './src/Calls';
import { Caller, InCall, Ringing } from './src/InCall';
import { Conversation, Messages, Open } from './src/Messages';
import { SignIn } from './src/SignIn';
import { s, useTheme } from './src/theme';
import { Button, Header } from './src/ui';

type Tab = 'calls' | 'messages' | 'settings';

const callerOf = (params: Record<string, string>, from: string): Caller => ({
  number: from, name: params.callerName ?? '', store: params.store ?? '',
});

export default function App() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [me, setMe] = useState<Me | null>(null);
  const [storeId, setStoreId] = useState<number>();
  const [tab, setTab] = useState<Tab>('calls');
  const [open, setOpen] = useState<Open | null>(null);
  const [invite, setInvite] = useState<{ invite: CallInvite; caller: Caller } | null>(null);
  const [call, setCall] = useState<{ call: Call; caller: Caller } | null>(null);

  const signedOut = useCallback(async () => {
    await unregister(me);
    await forget();
    setMe(null);
    setSignedIn(false);
  }, [me]);

  const failed = useCallback((e: any) => {
    if (e instanceof SignedOut) {
      signedOut();
    } else {
      Alert.alert('Something went wrong', String(e?.message || e));
    }
  }, [signedOut]);

  // saved sign-in, and the link Chrome hands back after signing in
  useEffect(() => {
    const onLink = async ({ url }: { url: string }) => {
      if (!url.startsWith('techresq-phone://signin')) {
        return;
      }
      try {
        await finishSignIn(url);
        setSignInError('');
        setSignedIn(true);
      } catch (e: any) {
        setSignInError(e.message);
      }
    };
    load().then(async ok => {
      setSignedIn(ok);
      setReady(true);
      const url = await Linking.getInitialURL();
      if (url) {
        onLink({ url });
      }
    });
    const sub = Linking.addEventListener('url', onLink);
    return () => sub.remove();
  }, []);

  // once signed in: who we are, ring this phone, and text alerts
  useEffect(() => {
    if (!signedIn) {
      return;
    }
    (async () => {
      const who = await api<Me>('/phone/api/me/');
      setMe(who);
      const saved = Number(await helpers.get('store'));
      setStoreId(who.stores.find(x => x.id === saved)?.id ?? who.stores[0]?.id);
      await register(who);
      const push = await helpers.pushToken();
      if (push) {
        await api('/phone/api/push-token/', { push_token: push });
      }
    })().catch(failed);
  }, [signedIn, failed]);

  // calls: one ringing or in progress when the app opens (e.g. answered from the notification), and new ones
  useEffect(() => {
    const watchInvite = (inv: CallInvite) => {
      const caller = callerOf(inv.getCustomParameters(), inv.getFrom());
      setInvite({ invite: inv, caller });
      inv.on(CallInvite.Event.Accepted, (c: Call) => { setInvite(null); watchCall(c, caller); });
      inv.on(CallInvite.Event.Rejected, () => setInvite(null));
      inv.on(CallInvite.Event.Cancelled, () => setInvite(null));
    };
    const watchCall = (c: Call, caller: Caller) => {
      setCall({ call: c, caller });
      c.on(Call.Event.Disconnected, () => setCall(null));
      c.on(Call.Event.ConnectFailure, (err: any) => {
        setCall(null);
        Alert.alert("Call didn't connect", String(err?.message || err));
      });
    };
    voice.on(Voice.Event.CallInvite, watchInvite);
    voice.getCalls().then(calls => {
      const c = [...calls.values()][0];
      if (c) {
        watchCall(c, callerOf(c.getCustomParameters(), c.getFrom() ?? ''));
      }
    });
    voice.getCallInvites().then(invites => {
      const inv = [...invites.values()][0];
      if (inv) {
        watchInvite(inv);
      }
    });
    return () => {
      voice.off(Voice.Event.CallInvite, watchInvite);
    };
  }, []);

  const store = me?.stores.find(x => x.id === storeId);

  const startCall = async (number: string, name: string) => {
    try {
      const c = await dial(number, storeId, name);
      const caller = { number, name, store: store?.name ?? '' };
      setCall({ call: c, caller });
      c.on(Call.Event.Disconnected, () => setCall(null));
      c.on(Call.Event.ConnectFailure, (err: any) => {
        setCall(null);
        Alert.alert("Call didn't connect", String(err?.message || err));
      });
    } catch (e) {
      failed(e);
    }
  };

  const pickStore = async (id: number) => {
    setStoreId(id);
    await helpers.set('store', String(id));
  };

  let screen: React.ReactNode;
  if (!ready) {
    screen = null;
  } else if (!signedIn) {
    screen = <SignIn error={signInError} />;
  } else if (call) {
    screen = <InCall call={call.call} caller={call.caller} />;
  } else if (invite) {
    screen = <Ringing invite={invite.invite} caller={invite.caller} />;
  } else if (open) {
    screen = <Conversation open={open} storeId={storeId} onBack={() => setOpen(null)} onCall={startCall} />;
  } else {
    const sub = store ? `Calling from ${store.name}` : me ? 'No store phone number set up yet' : '';
    screen = (
      <View style={s.fill}>
        {tab === 'calls' ? <Calls onCall={startCall} store={sub} /> : null}
        {tab === 'messages' ? <Messages onOpen={setOpen} store={sub} /> : null}
        {tab === 'settings' ? (
          <View style={s.fill}>
            <Header title="Settings" sub={me?.name} />
            <View style={[s.pad, { gap: 12 }]}>
              <Text style={[s.h2, { color: t.ink }]}>Call and text from</Text>
              {me?.stores.length ? me.stores.map(x => (
                <Button key={x.id} title={`${x.name}  ${x.number}`} kind={x.id === storeId ? 'brand' : 'plain'} onPress={() => pickStore(x.id)} />
              )) : <Text style={[s.body, { color: t.muted }]}>Your store has no Twilio number yet. A manager adds it in the shop system: Settings → your store.</Text>}
              <Text style={[s.small, { color: t.muted }]}>Signed in to {siteAddress()}</Text>
              <Button title="Sign out" kind="plain" onPress={() => api('/phone/api/signout/', {}).catch(() => {}).finally(signedOut)} />
            </View>
          </View>
        ) : null}
        <View style={[s.row, { borderTopWidth: 1, borderColor: t.line, backgroundColor: t.card }]}>
          {(['calls', 'messages', 'settings'] as Tab[]).map(x => (
            <Pressable key={x} accessibilityRole="tab" accessibilityState={{ selected: tab === x }} onPress={() => setTab(x)}
              style={[s.fill, { paddingVertical: 14, alignItems: 'center' }]}>
              <Text style={[s.body, { color: tab === x ? t.brand : t.muted, fontWeight: tab === x ? '700' : '500' }]}>
                {x[0].toUpperCase() + x.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={t.bg === '#f8f8f8' ? 'dark-content' : 'light-content'} backgroundColor={t.card} />
      <SafeAreaView style={[s.fill, { backgroundColor: t.bg }]}>{screen}</SafeAreaView>
    </SafeAreaProvider>
  );
}
