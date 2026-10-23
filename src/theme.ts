import { StyleSheet, useColorScheme } from 'react-native';

// Tech ResQ green, as on the shop site
const light = {
  bg: '#f8f8f8', card: '#ffffff', ink: '#111827', muted: '#6b7280', line: '#e3e6ea',
  brand: '#4d812c', onBrand: '#ffffff', soft: '#eef8e7', danger: '#b42318', onDanger: '#ffffff',
};
const dark: typeof light = {
  bg: '#0f130d', card: '#1a2016', ink: '#f3f4f6', muted: '#9ca3af', line: '#2c3427',
  brand: '#73bf43', onBrand: '#12180e', soft: '#22301b', danger: '#f97066', onDanger: '#1a0705',
};
export type Theme = typeof light;

export const useTheme = () => (useColorScheme() === 'dark' ? dark : light);

export const s = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  pad: { padding: 16 },
  h1: { fontSize: 22, fontWeight: '700' },
  h2: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  item: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
