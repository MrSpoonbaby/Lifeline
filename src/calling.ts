/** Twilio Voice: this phone rings for the store's calls and places calls from the store's number. */
import { Voice } from '@twilio/voice-react-native-sdk';
import { api, Me } from './api';

export const voice = new Voice();

/** Ring this phone for incoming calls. The shop sends the customer's name as a call parameter for the call screen. */
export async function register(me: Me) {
  if (!me.voice_token) {
    return; // the shop system hasn't got its Twilio API key set yet
  }
  await voice.setIncomingCallContactHandleTemplate('${callerName}');
  await voice.register(me.voice_token);
}

export async function unregister(me: Me | null) {
  if (me?.voice_token) {
    await voice.unregister(me.voice_token).catch(() => {});
  }
}

/** Call a customer from a store's number. A fresh token each time: they last an hour. */
export async function dial(number: string, storeId: number | undefined, name: string) {
  const { voice_token } = await api<Me>('/phone/api/me/');
  if (!voice_token) {
    throw new Error("Calling isn't set up in the shop system yet (Twilio API key).");
  }
  return voice.connect(voice_token, {
    params: { To: number, store: String(storeId ?? '') },
    contactHandle: name || number,
    notificationDisplayName: name || number,
  });
}
