/** Local testing only: when the shop system runs with fake Twilio keys (me.simulated), these stand in for Twilio's Call
 *  and CallInvite so the dialer, call screen and its buttons can be tried without a real call. Each call is recorded in
 *  the shop system's call history, like a real one. */
import { Call, CallInvite } from '@twilio/voice-react-native-sdk';
import { api } from './api';

type Listener = (...args: any[]) => void;
const RING_SECONDS = 25;

class Emitter {
  private listeners = new Map<string, Set<Listener>>();
  on(event: string, fn: Listener) {
    this.listeners.set(event, (this.listeners.get(event) ?? new Set()).add(fn));
    return this;
  }
  off(event: string, fn: Listener) {
    this.listeners.get(event)?.delete(fn);
    return this;
  }
  protected emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }
}

const record = (number: string, incoming: boolean, status: string, seconds: number) =>
  api('/phone/api/simulate/', { action: 'call', number, incoming, status, seconds }).catch(() => {});

export class FakeCall extends Emitter {
  private state = Call.State.Connecting;
  private muted = false;
  private connectedAt?: Date;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private number: string, private incoming: boolean, private params: Record<string, string> = {}) {
    super();
    if (incoming) {
      this.later(300, () => this.connect());
    } else {
      // the customer's phone rings a few seconds, then they "answer"
      this.later(800, () => this.set(Call.State.Ringing, Call.Event.Ringing));
      this.later(4000, () => this.connect());
    }
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private set(state: Call.State, event: string) {
    this.state = state;
    this.emit(event);
  }

  private connect() {
    this.connectedAt = new Date();
    this.set(Call.State.Connected, Call.Event.Connected);
  }

  getState() { return this.state; }
  isMuted() { return this.muted; }
  async mute(mute: boolean) { this.muted = mute; return mute; }
  async sendDigits(_digits: string) {}
  getInitialConnectedTimestamp() { return this.connectedAt; }
  getCustomParameters() { return this.params; }
  getFrom() { return this.number; }

  async disconnect() {
    if (this.state === Call.State.Disconnected) {
      return;
    }
    this.timers.forEach(clearTimeout);
    const seconds = this.connectedAt ? Math.round((Date.now() - this.connectedAt.getTime()) / 1000) : 0;
    this.state = Call.State.Disconnected;
    // saved first, so the call list the app goes back to already has it
    await record(this.number, this.incoming, this.connectedAt ? 'completed' : 'canceled', seconds);
    this.emit(Call.Event.Disconnected);
  }
}

/** A customer calling in. Nobody answers in 25 seconds: a missed call, as the shop system would send to voicemail. */
export class FakeInvite extends Emitter {
  private timer: ReturnType<typeof setTimeout>;

  constructor(private number: string, private params: Record<string, string>) {
    super();
    this.timer = setTimeout(async () => {
      await record(this.number, true, 'no-answer', 0);
      this.emit(CallInvite.Event.Cancelled);
    }, RING_SECONDS * 1000);
  }

  getFrom() { return this.number; }
  getCustomParameters() { return this.params; }

  async accept() {
    clearTimeout(this.timer);
    const call = new FakeCall(this.number, true, this.params);
    this.emit(CallInvite.Event.Accepted, call);
    return call;
  }

  async reject() {
    clearTimeout(this.timer);
    await record(this.number, true, 'no-answer', 0);
    this.emit(CallInvite.Event.Rejected);
  }
}

/** Settings > Simulator: a customer from the shop system calls in. */
export async function ringIn(storeId: number | undefined) {
  const r = await api<{ number: string; name: string; store: string; out_of_store: boolean }>(
    '/phone/api/simulate/', { action: 'ring', store: storeId });
  // marked Out of store: the shop system wouldn't ring this phone
  return r.out_of_store ? null : new FakeInvite(r.number, { callerName: r.name, store: r.store });
}

/** Settings > Simulator: a customer texts the store, through the same path a real text takes. */
export const textIn = (storeId: number | undefined) =>
  api<{ number: string; name: string }>('/phone/api/simulate/', { action: 'text', store: storeId });

/** Settings > Simulator: a customer leaves the store a voicemail (a short test tone to play). */
export const voicemailIn = (storeId: number | undefined) =>
  api<{ number: string; name: string }>('/phone/api/simulate/', { action: 'voicemail', store: storeId });
