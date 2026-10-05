import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { flushQueue } from '@/services/activities/writeQueue';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSyncStore } from '@/stores/syncStore';

/** How long the connection must stay down before we say so, to avoid flicker on app start. */
const OFFLINE_GRACE_MS = 3000;

const changes = (n: number) => `${n} ${n === 1 ? 'change' : 'changes'}`;

/** Tells people when they're offline, what's waiting to sync, and what failed. */
export function SyncBanner() {
  const { colors } = useTheme();
  const online = useConnectionStore((s) => s.online);
  const waiting = useSyncStore((s) => s.ops.length);
  const failed = useSyncStore((s) => s.failed.length);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    if (online) {
      setShowOffline(false);
      return;
    }
    const id = setTimeout(() => setShowOffline(true), OFFLINE_GRACE_MS);
    return () => clearTimeout(id);
  }, [online]);

  if (failed > 0) {
    return (
      <View
        accessibilityRole="alert"
        style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: 8 }}
      >
        <Text style={{ fontWeight: '600' }}>{changes(failed)} couldn’t be saved</Text>
        <Text muted>The server didn’t accept {failed === 1 ? 'it' : 'them'}. You may no longer have permission.</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Retry"
              variant="secondary"
              onPress={() => {
                useSyncStore.getState().retryFailed();
                void flushQueue();
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Discard" variant="secondary" onPress={() => useSyncStore.getState().discardFailed()} />
          </View>
        </View>
      </View>
    );
  }

  if (!showOffline && waiting === 0) return null;

  const message = showOffline
    ? waiting > 0
      ? `Offline · ${changes(waiting)} will sync when you’re back online`
      : 'Offline · showing saved data. New logs will sync later'
    : `Syncing ${changes(waiting)}…`;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
    >
      <Text style={{ fontWeight: '600' }}>{message}</Text>
    </View>
  );
}
