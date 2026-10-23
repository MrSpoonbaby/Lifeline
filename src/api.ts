/** Talking to the shop system (the POS Takeover site's /phone/api/). */
import { Linking, NativeModules } from 'react-native';

type Helpers = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string | null): Promise<void>;
  pkce(): Promise<{ verifier: string; challenge: string }>;
  pushToken(): Promise<string | null>;
};
export const helpers: Helpers = NativeModules.PhoneHelpers;

export type Store = { id: number; name: string; number: string };
export type Me = { name: string; identity: string; voice_token: string; stores: Store[] };
export type Text = { id: number; body: string; incoming: boolean; ok: boolean; error: string; at: string; by: string };
export type Thread = Text & { number: string; name: string; store: number | null; store_name: string };
export type CallRow = {
  id: number; number: string; name: string; incoming: boolean; status: string; seconds: number;
  at: string; store_name: string; staff: string; voicemail: string;
};

let site = '';
let token = '';

export const siteAddress = () => site;

/** Saved sign-in, if any. */
export async function load(): Promise<boolean> {
  site = (await helpers.get('site')) ?? '';
  token = (await helpers.get('token')) ?? '';
  return Boolean(site && token);
}

export class SignedOut extends Error {}

export async function forget() {
  token = '';
  await helpers.set('token', null);
}

export async function api<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(site + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    await forget();
    throw new SignedOut('Signed out');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || `The shop system answered ${r.status}`);
  }
  return data as T;
}

/** Sign-in step 1: open the shop site's own Google sign-in in Chrome. It comes back through techresq-phone://signin. */
export async function startSignIn(address: string) {
  site = address.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(site)) {
    site = `https://${site}`;
  }
  const { verifier, challenge } = await helpers.pkce();
  await helpers.set('site', site);
  await helpers.set('verifier', verifier); // kept in case Android closes the app while Chrome is open
  await Linking.openURL(`${site}/phone/connect/?challenge=${challenge}`);
}

/** Sign-in step 2: swap the one-time code from the link for this phone's own token. */
export async function finishSignIn(url: string) {
  const code = /[?&]code=([\w-]+)/.exec(url)?.[1];
  site = (await helpers.get('site')) ?? '';
  const verifier = await helpers.get('verifier');
  if (!code || !verifier || !site) {
    throw new Error('That sign-in link is incomplete. Try again.');
  }
  const r = await fetch(`${site}/phone/api/signin/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, verifier }),
  });
  const data = await r.json().catch(() => ({}));
  await helpers.set('verifier', null);
  if (!r.ok || !data.token) {
    throw new Error(data.error || 'Sign-in failed. Try again.');
  }
  token = data.token;
  await helpers.set('token', token);
}

/** (555) 123-4567 for US numbers, as given otherwise. */
export function pretty(number: string) {
  const d = number.replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : number;
}

export function when(iso: string) {
  const t = new Date(iso);
  const today = new Date().toDateString() === t.toDateString();
  return today
    ? t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : t.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
