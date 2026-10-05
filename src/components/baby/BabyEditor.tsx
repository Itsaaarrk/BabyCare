import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, View } from 'react-native';

import { BabyAvatar } from '@/components/baby/BabyAvatar';
import { LockedFeature } from '@/components/billing/LockedFeature';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { MIN_TOUCH_TARGET } from '@/constants/theme';
import { babyFormSchema, type BabyFormValues } from '@/features/babies/schemas';
import type { BabyEntry } from '@/hooks/useBabies';
import { useRoomPlan } from '@/hooks/useEntitlement';
import { useTheme } from '@/hooks/useTheme';
import { PLAN_NAME, PLUS_LIMITS } from '@/lib/billing/config';
import { toDateString } from '@/lib/date/age';
import { errorDetails, logHandled, toUserMessage } from '@/lib/errors';
import {
  addBaby,
  createBabyWithRoom,
  deleteBaby,
  setBabyPhotoPath,
  updateBaby,
} from '@/services/babies/babyService';
import {
  compressImage,
  PhotoTooLargeError,
  uploadBabyPhoto,
} from '@/services/storage/photoService';
import { useAuthStore } from '@/stores/authStore';
import { useBabyStore } from '@/stores/babyStore';
import type { Gender } from '@/types/baby';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'girl', label: 'Girl' },
  { value: 'boy', label: 'Boy' },
  { value: 'other', label: 'Other' },
];

interface Props {
  /** Present when editing an existing baby. */
  baby?: BabyEntry;
}

export function BabyEditor({ baby }: Props) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const rooms = useBabyStore((s) => s.rooms);
  const select = useBabyStore((s) => s.select);
  const ownedRoomId = Object.entries(rooms).find(([, room]) => room.role === 'owner')?.[0];
  const plan = useRoomPlan(ownedRoomId);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Once the profile itself is saved, a photo retry must not save it a second time.
  const saved = useRef<{ roomId: string; babyId: string } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<BabyFormValues>({
    resolver: zodResolver(babyFormSchema),
    defaultValues: {
      name: baby?.name ?? '',
      nickname: baby?.nickname ?? '',
      birthDate: baby?.birthDate ?? toDateString(new Date()),
      birthTime: baby?.birthTime ?? '',
      gender: baby?.gender,
      notes: baby?.notes ?? '',
    },
  });

  const pickPhoto = async () => {
    setPhotoError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset) setPhotoUri(await compressImage(asset.uri, asset.width));
    } catch (error) {
      logHandled('picking or compressing the photo', error);
      setPhotoError(`That photo couldn’t be loaded. Please try another.${errorDetails(error)}`);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    setFormError(null);
    setPhotoError(null);

    try {
      if (!saved.current) {
        if (baby) {
          await updateBaby(baby.roomId, baby.id, values);
          saved.current = { roomId: baby.roomId, babyId: baby.id };
        } else {
          saved.current = ownedRoomId
            ? { roomId: ownedRoomId, babyId: await addBaby(ownedRoomId, values) }
            : await createBabyWithRoom(user, values);
        }
      }
    } catch (error) {
      setFormError(toUserMessage(error));
      return;
    }

    const { roomId, babyId } = saved.current;
    if (photoUri) {
      try {
        setProgress(0);
        const path = await uploadBabyPhoto(roomId, babyId, photoUri, setProgress);
        await setBabyPhotoPath(roomId, babyId, path, baby?.photoPath);
      } catch (error) {
        setProgress(null);
        logHandled('baby photo upload', error);
        setPhotoError(
          error instanceof PhotoTooLargeError
            ? 'That photo is too large. Choose a smaller one.'
            : `Your baby’s profile was saved, but the photo didn’t upload. Retry, or skip for now.${errorDetails(error)}`,
        );
        return;
      }
      setProgress(null);
    }

    if (!baby) select({ roomId, babyId });
    if (baby) router.back();
    else router.replace('/');
  });

  const skipPhoto = () => {
    if (!baby && saved.current) select(saved.current);
    if (baby) router.back();
    else router.replace('/');
  };

  const confirmDelete = () => {
    if (!baby) return;
    Alert.alert(
      `Delete ${baby.name}?`,
      'This removes the profile for everyone in the family room. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteBaby(baby);
              router.replace('/');
            } catch (error) {
              setFormError(toUserMessage(error));
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  // A room that is full can't take another baby. Say so up front instead of failing on save. Once a
  // baby has been saved here (retrying a photo, say) the form must stay.
  if (!baby && ownedRoomId && !plan.canAddBaby && !saved.current) {
    return (
      <Screen topInset={false}>
        <LockedFeature
          title="More babies"
          description={`Your plan includes ${plan.limits.maxBabies} ${plan.limits.maxBabies === 1 ? 'baby' : 'babies'}. ${PLAN_NAME} lets a family room track up to ${PLUS_LIMITS.maxBabies}.`}
        />
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const busy = isSubmitting || deleting;
  const photoUploadFailed = photoError !== null && saved.current !== null;

  return (
    <Screen topInset={false}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <BabyAvatar size={112} photoPath={baby?.photoPath} localUri={photoUri ?? undefined} />
        <Button
          label={photoUri || baby?.photoPath ? 'Change photo' : 'Add photo'}
          variant="secondary"
          onPress={pickPhoto}
          disabled={busy}
        />
        {progress !== null ? (
          <Text variant="caption" muted accessibilityLiveRegion="polite">
            Uploading photo… {Math.round(progress * 100)}%
          </Text>
        ) : null}
        {photoError ? (
          <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
            {photoError}
          </Text>
        ) : null}
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            label="Baby’s name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="words"
          />
        )}
      />
      <Controller
        control={control}
        name="nickname"
        render={({ field, fieldState }) => (
          <TextField
            label="Nickname (optional)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="words"
          />
        )}
      />
      <Controller
        control={control}
        name="birthDate"
        render={({ field, fieldState }) => (
          <DateField
            label="Birth date"
            mode="date"
            value={field.value}
            onChange={field.onChange}
            maximumDate={new Date()}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="birthTime"
        render={({ field, fieldState }) => (
          <DateField
            label="Birth time (optional)"
            mode="time"
            value={field.value}
            onChange={field.onChange}
            allowClear
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <View style={{ gap: 6 }}>
            <Text variant="caption" muted>
              Gender (optional)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {GENDER_OPTIONS.map((option) => {
                const selected = field.value === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                    // Tapping the selected option again clears it.
                    onPress={() => field.onChange(selected ? undefined : option.value)}
                    style={{
                      flex: 1,
                      minHeight: MIN_TOUCH_TARGET,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.surfaceMuted : 'transparent',
                    }}
                  >
                    <Text style={{ fontWeight: selected ? '700' : '400' }}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field, fieldState }) => (
          <TextField
            label="Notes (optional)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            multiline
            style={{ minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }}
          />
        )}
      />

      {formError ? (
        <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {formError}
        </Text>
      ) : null}

      <Button
        label={photoUploadFailed ? 'Retry photo upload' : baby ? 'Save changes' : 'Save baby'}
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={deleting}
      />
      {photoUploadFailed ? (
        <Button label="Skip photo for now" variant="secondary" onPress={skipPhoto} />
      ) : null}
      {baby ? (
        <Button label="Delete baby" variant="danger" onPress={confirmDelete} loading={deleting} disabled={busy} />
      ) : null}
    </Screen>
  );
}
