/** How the app looks, picked in Settings and saved on the phone: light / dark / follow the phone, an accent color (the
 *  phone's own, Tech ResQ green or one of the shop website's), font and text size, a background (plain, a gradient or
 *  their own photo), glass, and the order of the tabs. */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { helpers } from './api';

export type Mode = 'system' | 'light' | 'dark';
export type Accent = 'default' | 'phone' | 'green' | 'blue' | 'teal' | 'purple' | 'orange' | 'rose' | 'slate';
export type Font = 'system' | 'inter' | 'readable';
export type TextSize = 's' | 'm' | 'l';
export type Background = 'plain' | 'gradient' | 'photo';
export type Gradient = 'accent' | 'sunset' | 'ocean' | 'aurora' | 'berry' | 'forest' | 'mono';
export type Level = 'low' | 'mid' | 'high';
export type TabKey = 'keypad' | 'calls' | 'voicemail' | 'messages'; // Settings opens from the profile menu, not a tab

type Colors = {
  bg: string; card: string; ink: string; muted: string; line: string;
  brand: string; onBrand: string; soft: string; danger: string; onDanger: string;
  key: string; keyPressed: string; call: string;
  bubbleIn: string; onBubbleIn: string; bubbleOut: string; onBubbleOut: string;
};
export type Theme = Colors & {
  dark: boolean; glass: boolean; font: string | undefined; scale: number;
  plainBg: string; // the page color under a gradient or photo
};

// Tech ResQ green, as on the shop site
const COLORS: { light: Colors; dark: Colors } = {
  light: { bg: '#f8f8f8', card: '#ffffff', ink: '#111827', muted: '#6b7280', line: '#e3e6ea',
    brand: '#4d812c', onBrand: '#ffffff', soft: '#eef8e7', danger: '#b42318', onDanger: '#ffffff',
    key: '#e5e5ea', keyPressed: '#c7c7cc', call: '#34c759',
    bubbleIn: '#ffffff', onBubbleIn: '#111827', bubbleOut: '#4d812c', onBubbleOut: '#ffffff' },
  dark: { bg: '#0f130d', card: '#1a2016', ink: '#f3f4f6', muted: '#9ca3af', line: '#2c3427',
    brand: '#73bf43', onBrand: '#12180e', soft: '#22301b', danger: '#f97066', onDanger: '#1a0705',
    key: '#333333', keyPressed: '#5a5a5e', call: '#34c759',
    bubbleIn: '#1a2016', onBubbleIn: '#f3f4f6', bubbleOut: '#73bf43', onBubbleOut: '#12180e' },
};

type Shades = { light: string; lightSoft: string; dark: string; darkSoft: string };
// the shop website's accents (app.css): button color and its soft tint in light, link color and soft tint in dark
const ACCENTS: Record<Exclude<Accent, 'default' | 'phone'>, Shades> = {
  green: { light: '#4d812c', lightSoft: '#eef8e7', dark: '#73bf43', darkSoft: '#22301b' },
  blue: { light: '#1d5fbf', lightSoft: '#e8f0fb', dark: '#7fb2f0', darkSoft: '#172235' },
  teal: { light: '#0f766e', lightSoft: '#e3f5f3', dark: '#5fd0c4', darkSoft: '#10292a' },
  purple: { light: '#6d3fc0', lightSoft: '#f1ebfc', dark: '#b79cf5', darkSoft: '#231b35' },
  orange: { light: '#b4520a', lightSoft: '#fdf0e5', dark: '#f5a866', darkSoft: '#33220f' },
  rose: { light: '#be185d', lightSoft: '#fce8f1', dark: '#f48fb8', darkSoft: '#34142a' },
  slate: { light: '#475569', lightSoft: '#eef1f5', dark: '#b4c0d0', darkSoft: '#1e2530' },
};
export const ACCENT_SWATCHES = Object.entries(ACCENTS).map(([key, v]) => [key, v.light]) as [Accent, string][];
const FONTS: Record<Font, string | undefined> = { system: undefined, inter: 'Inter', readable: 'Atkinson' }; // assets/fonts
const SCALES: Record<TextSize, number> = { s: 0.92, m: 1, l: 1.14 };

// background gradients: two colors washing in from opposite corners ('accent' uses the accent and the call green)
export const GRADIENTS: Record<Gradient, [string, string] | null> = {
  accent: null, sunset: ['#ff7e5f', '#feb47b'], ocean: ['#2193b0', '#6dd5ed'], aurora: ['#7f5af0', '#2cb67d'],
  berry: ['#c471f5', '#fa71cd'], forest: ['#134e5e', '#71b280'], mono: ['#9ca3af', '#4b5563'],
};

export const MODES: [Mode, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
export const FONT_CHOICES: [Font, string][] = [['system', "Phone's font"], ['inter', 'Inter'], ['readable', 'Easy reading']];
export const TEXT_SIZES: [TextSize, string][] = [['s', 'Small'], ['m', 'Default'], ['l', 'Large']];
export const BACKGROUNDS: [Background, string][] = [['plain', 'Plain'], ['gradient', 'Gradient'], ['photo', 'Photo']];
export const LEVELS: [Level, string][] = [['low', 'Soft'], ['mid', 'Medium'], ['high', 'Strong']];
export const TAB_KEYS: TabKey[] = ['keypad', 'calls', 'voicemail', 'messages'];

export type Saved = {
  mode: Mode; accent: Accent; font: Font; textSize: TextSize; glass: boolean; tabs: TabKey[];
  background: Background; gradient: Gradient; strength: Level; // the gradient's
  photo: string; dim: Level; blur: Level | 'off'; // the photo's (a file:// copy in the app's own storage)
};
type Prefs = Saved & { set: <K extends keyof Saved>(key: K, value: Saved[K]) => void; phoneAccent: Shades | null };
const DEFAULTS: Saved = {
  mode: 'system', accent: 'default', font: 'system', textSize: 'm', glass: false, tabs: TAB_KEYS,
  background: 'plain', gradient: 'accent', strength: 'mid', photo: '', dim: 'mid', blur: 'off',
};
const PrefsContext = createContext<Prefs>({ ...DEFAULTS, set: () => {}, phoneAccent: null });

/** A saved tab order, with any tab a newer app version added put at the end. */
const tabOrder = (saved: unknown): TabKey[] => {
  const known = Array.isArray(saved) ? saved.filter((k): k is TabKey => TAB_KEYS.includes(k)) : [];
  return [...new Set([...known, ...TAB_KEYS])];
};

const oneOf = <T,>(value: unknown, choices: readonly T[], fallback: T): T => (choices.includes(value as T) ? (value as T) : fallback);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Saved>(DEFAULTS);
  const [phoneAccent, setPhoneAccent] = useState<Shades | null>(null);
  useEffect(() => {
    helpers.systemAccent().then(setPhoneAccent, () => {});
    helpers.get('appearance').then(raw => {
      try {
        const v = raw ? JSON.parse(raw) : {};
        const levels: Level[] = ['low', 'mid', 'high'];
        setSaved({
          mode: oneOf(v.mode, ['system', 'light', 'dark'] as Mode[], DEFAULTS.mode),
          accent: oneOf(v.accent, ['default', 'phone', ...Object.keys(ACCENTS)] as Accent[], DEFAULTS.accent),
          font: oneOf(v.font, Object.keys(FONTS) as Font[], DEFAULTS.font),
          textSize: oneOf(v.textSize, Object.keys(SCALES) as TextSize[], DEFAULTS.textSize),
          glass: v.glass === true,
          tabs: tabOrder(v.tabs),
          background: oneOf(v.background, ['plain', 'gradient', 'photo'] as Background[], DEFAULTS.background),
          gradient: oneOf(v.gradient, Object.keys(GRADIENTS) as Gradient[], DEFAULTS.gradient),
          strength: oneOf(v.strength, levels, DEFAULTS.strength),
          photo: typeof v.photo === 'string' ? v.photo : '',
          dim: oneOf(v.dim, levels, DEFAULTS.dim),
          blur: oneOf(v.blur, [...levels, 'off'] as (Level | 'off')[], DEFAULTS.blur),
        });
      } catch {} // unreadable: keep the defaults
    });
  }, []);
  const prefs = useMemo<Prefs>(() => ({
    ...saved,
    phoneAccent,
    set: (key, value) => setSaved(old => {
      const next = { ...old, [key]: value };
      helpers.set('appearance', JSON.stringify(next));
      return next;
    }),
  }), [saved, phoneAccent]);
  return <PrefsContext.Provider value={prefs}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);

export function useTheme(): Theme {
  const { mode, accent, font, textSize, glass, background, photo, phoneAccent } = useContext(PrefsContext);
  const system = useColorScheme();
  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';
  const backdrop = background === 'gradient' || (background === 'photo' && Boolean(photo));
  return useMemo(() => {
    const base = COLORS[dark ? 'dark' : 'light'];
    const t: Theme = { ...base, dark, glass, font: FONTS[font], scale: SCALES[textSize], plainBg: base.bg };
    const shades = accent === 'phone' ? phoneAccent : accent === 'default' ? null : ACCENTS[accent];
    if (shades) {
      t.brand = t.bubbleOut = dark ? shades.dark : shades.light;
      t.onBrand = t.onBubbleOut = dark ? '#0b0f14' : '#ffffff';
      t.soft = dark ? shades.darkSoft : shades.lightSoft;
    }
    if (backdrop) {
      t.bg = 'transparent'; // the gradient or photo shows behind the screens
    }
    if (glass) {
      // see-through panels (over the gradient or photo, if there is one), like the website's Glass
      t.bg = 'transparent';
      t.card = dark ? 'rgba(40,40,46,0.55)' : 'rgba(255,255,255,0.62)';
      t.line = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)';
    }
    return t;
  }, [dark, accent, font, textSize, glass, backdrop, phoneAccent]);
}

export const s = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  pad: { padding: 16 },
  h1: { fontSize: 22, fontWeight: '700' },
  h2: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  button: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  // a list row: its own rounded card
  item: { marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  list: { paddingTop: 10, paddingBottom: 8 },
});
