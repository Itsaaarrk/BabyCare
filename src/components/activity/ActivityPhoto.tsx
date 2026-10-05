import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { logHandled } from '@/lib/errors';
import { getPhotoUrl } from '@/services/storage/photoService';

export function ActivityPhoto({ photoPath }: { photoPath: string }) {
  const { colors } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setFailed(false);
    getPhotoUrl(photoPath)
      .then((url) => !cancelled && setUri(url))
      .catch((error) => {
        logHandled(`activity photo URL for ${photoPath}`, error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  return (
    <View
      style={{
        height: 220,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityLabel="Activity photo"
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          onError={(event) => {
            logHandled(`activity photo failed to display (${uri.slice(0, 80)})`, event.nativeEvent.error);
            setFailed(true);
            setUri(null);
          }}
        />
      ) : failed ? (
        <Text muted>Photo unavailable right now</Text>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  );
}
