import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { helpers } from './api';
import { s, useTheme } from './theme';
import { Button } from './ui';

/** Scan the QR from the shop system's Settings > Phone app. It holds the site's address and a one-time code. */
export function SignIn({ error, onScanned }: { error: string; onScanned: (link: string) => void }) {
  const t = useTheme();
  const [problem, setProblem] = useState('');

  const scan = async () => {
    try {
      const link = await helpers.scanQr();
      if (link) {
        onScanned(link);
      }
    } catch (e: any) {
      setProblem(e.message);
    }
  };

  return (
    <View style={[s.fill, s.pad, { justifyContent: 'center', gap: 16, backgroundColor: t.bg }]}>
      <Text style={[s.h1, { color: t.ink }]}>Tech ResQ Phone</Text>
      <Text style={[s.body, { color: t.muted }]}>
        On a computer, open the shop system and go to Settings → Phone app → Show QR code. Then scan it here.
      </Text>
      <Button title="Scan QR code" onPress={scan} />
      <Text style={[s.small, { color: t.muted }]}>You can also point this phone's camera at the code.</Text>
      {problem || error ? <Text style={[s.body, { color: t.danger }]}>{problem || error}</Text> : null}
    </View>
  );
}
