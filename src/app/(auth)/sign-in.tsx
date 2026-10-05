import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { GoogleSignInSection } from '@/components/auth/GoogleSignInSection';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { signInSchema, type SignInValues } from '@/features/auth/schemas';
import { toUserMessage } from '@/lib/errors';
import { requestPasswordReset, signInWithEmail } from '@/services/auth/authService';

export default function SignInScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    getValues,
    trigger,
    formState: { isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setNotice(null);
    try {
      await signInWithEmail(email, password);
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  });

  const onForgotPassword = async () => {
    setFormError(null);
    setNotice(null);
    if (!(await trigger('email'))) return;
    try {
      await requestPasswordReset(getValues('email'));
    } catch {
      // Intentionally ignored so the response doesn't reveal whether an account exists.
    }
    setNotice('If an account exists for that email, a reset link is on its way.');
  };

  return (
    <Screen>
      <View style={{ gap: 4, marginTop: 24 }}>
        <Text variant="title">Welcome back</Text>
        <Text muted>Sign in to your family's baby-care journal.</Text>
      </View>

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label="Password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={onSubmit}
          />
        )}
      />

      {formError ? <Text accessibilityLiveRegion="polite">{formError}</Text> : null}
      {notice ? <Text muted accessibilityLiveRegion="polite">{notice}</Text> : null}

      <Button label="Sign in" onPress={onSubmit} loading={isSubmitting} />
      <Button label="Forgot password?" variant="secondary" onPress={onForgotPassword} />

      <GoogleSignInSection onError={setFormError} disabled={isSubmitting} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Text muted>New here?</Text>
        <Link href="/sign-up" accessibilityRole="link">
          <Text style={{ fontWeight: '600' }}>Create an account</Text>
        </Link>
      </View>
    </Screen>
  );
}
