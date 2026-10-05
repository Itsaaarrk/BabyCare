import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useRooms } from '@/hooks/useRooms';
import { toUserMessage } from '@/lib/errors';
import {
  confirmWithGoogle,
  confirmWithPassword,
  currentSignInMethod,
  deleteMyAccount,
} from '@/services/auth/accountService';

/** Settings → Delete account. Permanent, so it asks the person to prove who they are first. */
export default function DeleteAccountScreen() {
  const { rooms } = useRooms();
  const ownedRooms = rooms.filter((room) => room.role === 'owner');
  const method = currentSignInMethod();

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ownedRooms.length > 0) {
    return (
      <Screen topInset={false}>
        <Card>
          <Text variant="heading">You own a family room</Text>
          <Text>
            {ownedRooms.map((room) => room.info.name).join(', ')} belongs to you. Rooms can’t be handed to someone else
            yet, so delete the room first. That removes its babies, photos and entries for everyone.
          </Text>
          <Text muted>After that you can come back here and delete your account.</Text>
          <Button label="Go to Family" onPress={() => router.push('/family')} />
        </Card>
      </Screen>
    );
  }

  const run = async (confirm: () => Promise<boolean>) => {
    setBusy(true);
    setError(null);
    try {
      if (!(await confirm())) return;
      await deleteMyAccount();
      // Signing out sends the app back to the sign-in screen.
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const askToDelete = () =>
    Alert.alert('Delete your account?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            if (method === 'google') return confirmWithGoogle();
            await confirmWithPassword(password);
            return true;
          }),
      },
    ]);

  return (
    <Screen topInset={false}>
      <Card>
        <Text variant="heading">What happens</Text>
        <Text>• Your account and sign-in are permanently deleted.</Text>
        <Text>• You leave the family rooms you belong to, and your settings are removed.</Text>
        <Text>
          • Entries you logged stay in your family’s journal under the name you used, because they belong to the
          family. Babies, photos and everyone else’s entries aren’t touched.
        </Text>
        <Text>• You can create a new account later, but this one can’t be recovered.</Text>
      </Card>

      {method === 'password' ? (
        <TextField
          label="Enter your password to confirm"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={() => password.length > 0 && askToDelete()}
        />
      ) : method === 'google' ? (
        <Text muted>You’ll be asked to choose your Google account again to confirm.</Text>
      ) : (
        <Text muted>Sign out and sign in again, then come back here to delete your account.</Text>
      )}

      {error ? <Text accessibilityLiveRegion="polite">{error}</Text> : null}

      <View style={{ gap: 8 }}>
        <Button
          label="Delete my account"
          variant="danger"
          onPress={askToDelete}
          loading={busy}
          disabled={method === 'unknown' || (method === 'password' && password.length === 0)}
        />
        <Button label="Keep my account" variant="secondary" onPress={() => router.back()} disabled={busy} />
      </View>
    </Screen>
  );
}
