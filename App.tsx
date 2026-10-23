/** Tech ResQ Phone: the store's business line on staff phones. See docs/design.md. */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StatusBar, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Call, CallInvite, Voice } from '@twilio/voice-react-native-sdk';
import { api, CallRow, forget, helpers, load, Me, signIn, SignedOut } from './src/api';
import { dial, register, unregister, voice } from './src/calling';
import { Calls } from './src/Calls';
import { DialPad } from './src/Keypad';
import { CallLike, Caller, InCall, InviteLike, Ringing } from './src/InCall';
import { ringIn, textIn, voicemailIn } from './src/simulator';
import { Conversation, Messages, Open } from './src/Messages';
import { SignIn } from './src/SignIn';
import { KeypadIcon, MessagesIcon, RecentsIcon, VoicemailIcon } from './src/icons';
import { Settings } from './src/Settings';
import { StoreContext } from './src/stores';
import { s, TabKey, ThemeProvider, usePrefs, useTheme } from './src/theme';
import { Backdrop, Button, Link, TabBar, TabItem, Text } from './src/ui';
import { TopBar } from './src/TopBar';
import { Voicemail } from './src/Voicemail';

type Tab = TabKey | 'settings'; // Settings is a screen from the profile menu, not in the tab bar

const callerOf = (params: Record<string, string>, from: string): Caller => ({
  number: from, name: params.callerName ?? '', store: params.store ?? '',
});

export default function Root() {
  return <ThemeProvider><App /></ThemeProvider>;
}

function App() {
  const t = useTheme();
  const prefs = usePrefs();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [session, setSession] = useState(0); // a new sign-in, even over an old one
  const [me, setMe] = useState<Me | null>(null);
  const [storeId, setStoreId] = useState<number>();
  const [chosenTab, setTab] = useState<Tab | null>(null);
  const [lastTab, setLastTab] = useState<TabKey | null>(null); // where Settings' Back goes
  const tab = chosenTab ?? prefs.tabs[0]; // opens on the first tab in Settings' order
  const openSettings = () => {
    if (tab !== 'settings') {
      setLastTab(tab);
    }
    setTab('settings');
  };
  const [open, setOpen] = useState<Open | null>(null);
  const [invite, setInvite] = useState<{ invite: InviteLike; caller: Caller } | null>(null);
  const [call, setCall] = useState<{ call: CallLike; caller: Caller } | null>(null);
  const [newVoicemail, setNewVoicemail] = useState(0);

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

  // a QR sign-in: scanned in the app, or opened by pointing the phone's camera at it (a techresq-phone:// link)
  const openLink = useCallback(async (url: string) => {
    if (!url.startsWith('techresq-phone://signin')) {
      return;
    }
    try {
      await unregister(me); // signing in again, maybe as someone else
      await signIn(url);
      setSignInError('');
      setMe(null);
      setSession(n => n + 1);
      setSignedIn(true);
    } catch (e: any) {
      setSignInError(e.message);
    }
  }, [me]);

  useEffect(() => {
    load().then(async ok => {
      setSignedIn(ok);
      setReady(true);
      const url = await Linking.getInitialURL();
      if (url) {
        openLink(url);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => openLink(url));
    return () => sub.remove();
  }, [openLink]);

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
  }, [signedIn, session, failed]);

  const watchCall = useCallback((c: CallLike, caller: Caller) => {
    setCall({ call: c, caller });
    c.on(Call.Event.Disconnected, () => setCall(null));
    c.on(Call.Event.ConnectFailure, (err: any) => {
      setCall(null);
      Alert.alert("Call didn't connect", String(err?.message || err));
    });
  }, []);

  const watchInvite = useCallback((inv: InviteLike) => {
    const caller = callerOf(inv.getCustomParameters(), inv.getFrom());
    setInvite({ invite: inv, caller });
    inv.on(CallInvite.Event.Accepted, (c: CallLike) => { setInvite(null); watchCall(c, caller); });
    inv.on(CallInvite.Event.Rejected, () => setInvite(null));
    inv.on(CallInvite.Event.Cancelled, () => setInvite(null));
  }, [watchCall]);

  // calls: one ringing or in progress when the app opens (e.g. answered from the notification), and new ones
  useEffect(() => {
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
  }, [watchCall, watchInvite]);

  // the badge on the Voicemail tab
  const countVoicemail = useCallback(() => {
    api<{ calls: CallRow[] }>('/phone/api/calls/')
      .then(r => setNewVoicemail(r.calls.filter(c => c.voicemail && !c.heard).length), () => {});
  }, []);
  useEffect(() => {
    if (!me) {
      return;
    }
    countVoicemail();
    const timer = setInterval(countVoicemail, 30000);
    return () => clearInterval(timer);
  }, [me, countVoicemail]);

  const store = me?.stores.find(x => x.id === storeId);
  const away = Boolean(me?.out_of_store);

  // Out of store: the shop system stops ringing this person's phones and alerting them
  const setAway = (out: boolean) => {
    setMe(m => (m ? { ...m, out_of_store: out } : m));
    api<{ out_of_store: boolean }>('/phone/api/status/', { out_of_store: out })
      .then(r => setMe(m => (m ? { ...m, out_of_store: r.out_of_store } : m)), failed);
  };

  const startCall = async (number: string, name: string) => {
    try {
      watchCall(await dial(number, storeId, name), { number, name, store: store?.name ?? '' });
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
    screen = <SignIn error={signInError} onScanned={openLink} />;
  } else if (call) {
    screen = <InCall call={call.call} caller={call.caller} />;
  } else if (invite) {
    screen = <Ringing invite={invite.invite} caller={invite.caller} />;
  } else if (open) {
    screen = <Conversation open={open} storeId={storeId} onBack={() => setOpen(null)} onCall={startCall} />;
  } else {
    screen = (
      <View style={s.fill}>
        {me ? <TopBar me={me} away={away} onAway={setAway} onSettings={openSettings} /> : null}
        {away ? (
          <View style={[s.row, { gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: t.dark ? '#3a2a05' : '#fff4d6' }]}>
            <Text style={[s.small, s.fill, { color: t.dark ? '#ffd98a' : '#5c4100' }]}>
              Out of store: calls don't ring this phone, and texts and voicemail arrive without alerts.
            </Text>
            <Link title="I'm back" onPress={() => setAway(false)} />
          </View>
        ) : null}
        {!store && me ? (
          <Text style={[s.small, { color: t.danger, paddingHorizontal: 16, paddingVertical: 8 }]}>
            Your store has no Twilio number yet. A manager adds it in the shop system: Settings, then your store.
          </Text>
        ) : null}
        {tab === 'keypad' ? <DialPad onCall={startCall} /> : null}
        {tab === 'calls' ? <Calls onCall={startCall} /> : null}
        {tab === 'messages' ? <Messages onOpen={setOpen} /> : null}
        {tab === 'voicemail' ? <Voicemail onCall={startCall} onSeen={countVoicemail} /> : null}
        {tab === 'settings' ? (
          <Settings me={me} away={away} onAway={setAway} tabLabels={TAB_LABELS} onBack={() => setTab(lastTab ?? prefs.tabs[0])}
            onSignOut={() => api('/phone/api/signout/', {}).catch(() => {}).finally(signedOut)}
            simulator={me?.simulated ? (
              <View style={{ gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: t.line, borderStyle: 'dashed' }}>
                <Text style={[s.h2, { color: t.ink }]}>Simulator</Text>
                <Text style={[s.small, { color: t.muted }]}>
                  The shop system is running with fake Twilio keys (local testing). Calls are acted out in the app and
                  texts don't leave the PC. Everything still shows up in Calls, Voicemail and Messages.
                </Text>
                <Button title="Simulate an incoming call" onPress={() => ringIn(storeId).then(inv => (inv ? watchInvite(inv)
                  : Alert.alert('Out of store', "This phone wouldn't ring: you're marked Out of store. The call rings the others at the store, or goes to voicemail.")), failed)} />
                <Button title="Simulate an incoming text" kind="plain"
                  onPress={() => textIn(storeId).then(r => Alert.alert('Text received', `From ${r.name || r.number}. See Messages.`), failed)} />
                <Button title="Simulate a voicemail" kind="plain"
                  onPress={() => voicemailIn(storeId).then(() => { countVoicemail(); setTab('voicemail'); }, failed)} />
              </View>
            ) : null} />
        ) : null}
        <TabBar tabs={prefs.tabs.map(key => ({ ...TABS[key], badge: key === 'voicemail' ? newVoicemail : 0 }))} active={tab} onPress={setTab} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StoreContext.Provider value={{ stores: me?.stores ?? [], current: store, pick: pickStore }}>
        <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} backgroundColor={t.bg === 'transparent' ? t.plainBg : t.bg} />
        <Backdrop />
        <SafeAreaView style={[s.fill, { backgroundColor: t.bg }]}>{screen}</SafeAreaView>
      </StoreContext.Provider>
    </SafeAreaProvider>
  );
}

const TABS: Record<TabKey, TabItem<Tab>> = {
  keypad: { key: 'keypad', label: 'Keypad', icon: KeypadIcon },
  calls: { key: 'calls', label: 'Recents', icon: RecentsIcon },
  voicemail: { key: 'voicemail', label: 'Voicemail', icon: VoicemailIcon },
  messages: { key: 'messages', label: 'Messages', icon: MessagesIcon },
};
const TAB_LABELS = Object.fromEntries(Object.values(TABS).map(x => [x.key, x.label])) as Record<TabKey, string>;
