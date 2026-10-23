import React, { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { helpers, startSignIn } from './api';
import { s, useTheme } from './theme';
import { Button } from './ui';

/** The shop site's address, then its usual Google sign-in in Chrome. The app picks up again from the link it hands back. */
export function SignIn({ error }: { error: string }) {
  const t = useTheme();
  const [address, setAddress] = useState('');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    helpers.get('site').then(saved => saved && setAddress(saved));
  }, []);

  const go = () => startSignIn(address).catch(e => setProblem(String(e.message || e)));

  return (
    <View style={[s.fill, s.pad, { justifyContent: 'center', gap: 16, backgroundColor: t.bg }]}>
      <Text style={[s.h1, { color: t.ink }]}>Tech ResQ Phone</Text>
      <Text style={[s.body, { color: t.muted }]}>
        Sign in with your company Google account, the same way you sign in to the shop system.
      </Text>
      <View style={{ gap: 6 }}>
        <Text style={[s.small, { color: t.ink, fontWeight: '600' }]}>Shop system address</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="your-shop.onrender.com"
          placeholderTextColor={t.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[s.input, { color: t.ink, borderColor: t.line, backgroundColor: t.card }]}
        />
      </View>
      <Button title="Sign in" onPress={go} disabled={!address.trim()} />
      {problem || error ? <Text style={[s.body, { color: t.danger }]}>{problem || error}</Text> : null}
    </View>
  );
}
