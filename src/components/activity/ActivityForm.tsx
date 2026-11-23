import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { PhotoField } from '@/components/ui/PhotoField';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/hooks/useTheme';
import {
  activityFormSchema,
  emptyFormValues,
  toFormValues,
  type ActivityFormValues,
} from '@/features/activities/schemas';
import { DIAPER_TYPE_LABELS, FEEDING_TYPE_LABELS } from '@/lib/activity/meta';
import {
  AMOUNT_UNITS,
  BATH_CHOICES,
  BREAST_SIDES,
  DIAPER_TYPES,
  FEEDING_TYPES,
  isTimedType,
  type Activity,
  type ActivityType,
} from '@/types/activity';

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

const SIDES = BREAST_SIDES.map((value) => ({
  value,
  label: value === 'both' ? 'Both' : value === 'left' ? 'Left' : 'Right',
}));

interface Props {
  type: ActivityType;
  /** Present when editing. */
  activity?: Activity;
  /** Starting values for a new activity (e.g. a time a bit in the past). */
  initial?: Partial<ActivityFormValues>;
  submitLabel: string;
  onSubmit: (values: ActivityFormValues, photoUri: string | null) => void | Promise<void>;
  error?: string | null;
}

export function ActivityForm({ type, activity, initial, submitLabel, onSubmit, error }: Props) {
  const { colors } = useTheme();
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: activity ? toFormValues(activity) : { ...emptyFormValues(type), ...initial },
  });

  const timed = isTimedType(type);
  const startedAt = watch('startedAt');
  const endedAt = watch('endedAt');
  const feedingType = watch('feedingType');
  const running = endedAt === null;

  return (
    <View style={{ gap: 16 }}>
      <Controller
        control={control}
        name="startedAt"
        render={({ field, fieldState }) => (
          <DateTimeField
            label={timed ? 'Started' : 'When'}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      {timed ? (
        <>
          <ChoiceChips
            label="Status"
            options={[
              { value: 'finished', label: 'Finished' },
              { value: 'running', label: 'Still running' },
            ]}
            value={running ? 'running' : 'finished'}
            onChange={(v) => setValue('endedAt', v === 'running' ? null : Math.max(Date.now(), startedAt))}
          />
          {!running ? (
            <Controller
              control={control}
              name="endedAt"
              render={({ field, fieldState }) => (
                <DateTimeField
                  label="Ended"
                  value={field.value ?? startedAt}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          ) : null}
        </>
      ) : null}

      {type === 'feeding' ? (
        <>
          <Controller
            control={control}
            name="feedingType"
            render={({ field, fieldState }) => (
              <ChoiceChips
                label="Feeding type"
                options={options(FEEDING_TYPES, FEEDING_TYPE_LABELS)}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          {feedingType === 'breast' ? (
            <Controller
              control={control}
              name="side"
              render={({ field }) => (
                <ChoiceChips label="Side (optional)" options={SIDES} value={field.value} onChange={field.onChange} clearable />
              )}
            />
          ) : null}
          <Controller
            control={control}
            name="amount"
            render={({ field, fieldState }) => (
              <TextField
                label="Amount (optional)"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="amountUnit"
            render={({ field }) => (
              <ChoiceChips
                options={AMOUNT_UNITS.map((u) => ({ value: u, label: u }))}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
              />
            )}
          />
        </>
      ) : null}

      {type === 'diaper' ? (
        <Controller
          control={control}
          name="diaperType"
          render={({ field, fieldState }) => (
            <ChoiceChips
              label="Diaper"
              options={options(DIAPER_TYPES, DIAPER_TYPE_LABELS)}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      ) : null}

      {type === 'bath' ? (
        <Controller
          control={control}
          name="bathType"
          render={({ field, fieldState }) => (
            <ChoiceChips
              label="Bath type"
              options={options(
                // An older entry saved as plain "Bath" keeps that choice until it's changed.
                field.value === 'other' ? [...BATH_CHOICES, 'other' as const] : BATH_CHOICES,
                { morning: 'Morning', afternoon: 'Afternoon', night: 'Night', other: 'Bath' },
              )}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      ) : null}

      {type === 'note' ? (
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <TextField
              label="Title"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="notes"
        render={({ field, fieldState }) => (
          <TextField
            label={type === 'note' ? 'Description (optional)' : 'Notes (optional)'}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            multiline
            style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }}
          />
        )}
      />

      <PhotoField
        localUri={photoUri}
        hasSavedPhoto={!!activity?.photoPath}
        onChange={setPhotoUri}
        disabled={isSubmitting}
      />

      {error ? (
        <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button
        label={submitLabel}
        loading={isSubmitting}
        onPress={handleSubmit(async (values) => onSubmit(values, photoUri))}
      />
    </View>
  );
}
