import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { errorDetails, logHandled } from '@/lib/errors';
import { compressImage } from '@/services/storage/photoService';

interface Props {
  /** A just-picked local image, already compressed. */
  localUri: string | null;
  /** True when the activity already has a saved photo. */
  hasSavedPhoto?: boolean;
  onChange: (uri: string | null) => void;
  disabled?: boolean;
}

export function PhotoField({ localUri, hasSavedPhoto, onChange, disabled }: Props) {
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset) onChange(await compressImage(asset.uri, asset.width));
    } catch (error) {
      logHandled('picking or compressing the photo', error);
      setError(`That photo couldn’t be loaded. Please try another.${errorDetails(error)}`);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Text variant="caption" muted>
        Photo (optional)
      </Text>
      {localUri ? (
        <Image
          source={{ uri: localUri }}
          accessibilityLabel="Selected photo"
          style={{ height: 180, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted }}
        />
      ) : null}
      <Button
        label={localUri || hasSavedPhoto ? 'Change photo' : 'Add photo'}
        variant="secondary"
        onPress={pick}
        disabled={disabled}
      />
      {localUri ? <Button label="Remove selected photo" variant="secondary" onPress={() => onChange(null)} /> : null}
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
