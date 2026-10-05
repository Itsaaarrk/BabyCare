import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { GoogleSignInSection } from '@/components/auth/GoogleSignInSection';
import { LegalLinks } from '@/components/LegalLinks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { signUpSchema, type SignUpValues } from '@/features/auth/schemas';
import { toUserMessage } from '@/lib/errors';
import { registerWithEmail } from '@/services/auth/authService';

export default function SignUpScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ displayName, email, password }) => {
    setFormError(null);
    try {
      await registerWithEmail(displayName, email, password);
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  });

  return (
    <Screen>
      <View style={{ gap: 4, marginTop: 24 }}>
        <Text variant="title">Create your account</Text>
        <Text muted>Track your baby's day together with family and caregivers.</Text>
      </View>

      <Controller
        control={control}
        name="displayName"
        render={({ field, fieldState }) => (
          <TextField
            label="Your name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="name"
            textContentType="name"
          />
        )}
      />
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
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={onSubmit}
          />
        )}
      />

      {formError ? <Text accessibilityLiveRegion="polite">{formError}</Text> : null}

      <Button label="Create account" onPress={onSubmit} loading={isSubmitting} />

      <GoogleSignInSection onError={setFormError} disabled={isSubmitting} />

      <LegalLinks />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Text muted>Already have an account?</Text>
        <Link href="/sign-in" accessibilityRole="link">
          <Text style={{ fontWeight: '600' }}>Sign in</Text>
        </Link>
      </View>
    </Screen>
  );
}
