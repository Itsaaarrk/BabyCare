import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { toUserMessage } from '@/lib/errors';
import { signInWithGoogle } from '@/services/auth/authService';

interface Props {
  /** Called with a user-facing message when Google sign-in fails; null when a new attempt starts. */
  onError: (message: string | null) => void;
  /** True while the email form is submitting, so the two can't run at once. */
  disabled?: boolean;
}

/** "Or continue with Google". The same button signs in and signs up. */
export function GoogleSignInSection({ onError, disabled }: Props) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    onError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      onError(toUserMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text muted>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      <Button label="Continue with Google" variant="secondary" onPress={onPress} loading={busy} disabled={disabled} />
    </View>
  );
}
