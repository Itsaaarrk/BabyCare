import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { logHandled, logTrace } from '@/lib/errors';
import { getPhotoUrl } from '@/services/storage/photoService';

interface Props {
  size: number;
  /** Storage path of the saved photo. */
  photoPath?: string;
  /** A just-picked local image; takes precedence over the saved photo. */
  localUri?: string;
  label?: string;
}

export function BabyAvatar({ size, photoPath, localUri, label }: Props) {
  const { colors } = useTheme();
  const [remoteUri, setRemoteUri] = useState<string | null>(null);

  useEffect(() => {
    setRemoteUri(null);
    if (!photoPath) return;
    let cancelled = false;
    logTrace(`avatar: looking up ${photoPath}`);
    const slow = setTimeout(() => logTrace(`avatar: still waiting for the link to ${photoPath}`), 8000);
    getPhotoUrl(photoPath)
      .then((url) => {
        clearTimeout(slow);
        logTrace(`avatar: got link ${url.slice(0, 90)}…`);
        if (!cancelled) setRemoteUri(url);
      })
      .catch((error) => {
        clearTimeout(slow);
        // Fall back to the placeholder; the photo may simply not be readable yet.
        logHandled(`baby photo URL for ${photoPath}`, error);
      });
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, [photoPath]);

  const uri = localUri ?? remoteUri;
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  };

  return (
    <View
      style={[styles.frame, frame]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? 'Baby photo'}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={frame}
          onLoad={() => logTrace(`avatar: image drawn (${size}px)`)}
          onError={(event) => logHandled(`baby photo failed to display (${uri.slice(0, 80)})`, event.nativeEvent.error)}
        />
      ) : (
        <Text style={{ fontSize: size * 0.45 }}>👶</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
});
