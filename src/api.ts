/** Talking to the shop system (the POS Takeover site's /phone/api/). */
import { NativeModules } from 'react-native';

type Helpers = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string | null): Promise<void>;
  scanQr(): Promise<string | null>;
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

/** Sign in from the QR code on the shop system's Settings > Phone app: techresq-phone://signin?site=...&code=...
 *  The code works once, so the app swaps it for a token of its own. */
export async function signIn(link: string) {
  const param = (name: string) => {
    const v = new RegExp(`[?&]${name}=([^&#]+)`).exec(link)?.[1];
    return v ? decodeURIComponent(v.replace(/\+/g, ' ')) : '';
  };
  const address = param('site');
  const code = param('code');
  if (!link.startsWith('techresq-phone://signin') || !/^https?:\/\//.test(address) || !code) {
    throw new Error("That isn't a Tech ResQ Phone sign-in code. Use the one on Settings > Phone app in the shop system.");
  }
  const r = await fetch(`${address}/phone/api/signin/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.token) {
    throw new Error(data.error || "Sign-in didn't work. Show a new QR code and try again.");
  }
  site = address;
  token = data.token;
  await helpers.set('site', site);
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
