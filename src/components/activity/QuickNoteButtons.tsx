import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { emptyFormValues } from '@/features/activities/schemas';
import { useActivities, useActivityActions } from '@/hooks/useActivities';
import { useTheme } from '@/hooks/useTheme';
import { frequentNoteTitles } from '@/lib/activity/quickNotes';
import { createActivity } from '@/services/activities/activityService';

const DAY_MS = 86_400_000;
/** How long a button stays disabled after a tap, so a double tap logs once. */
const COOLDOWN_MS = 2_000;

interface Props {
  /** Called after a note is logged, e.g. to close a sheet. */
  onLogged?: (title: string) => void;
}

/**
 * One-tap buttons for the note titles this family logs most (e.g. "Burp"), learned from the last
 * two weeks of notes. Nothing is stored: the buttons come and go with how notes are used.
 */
export function QuickNoteButtons({ onLogged }: Props) {
  const { colors } = useTheme();
  const { activities } = useActivities();
  const { context, canAdd } = useActivityActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [lastLogged, setLastLogged] = useState<string | null>(null);

  const titles = useMemo(
    () => frequentNoteTitles(activities, { since: Date.now() - 14 * DAY_MS }),
    [activities],
  );

  useEffect(() => {
    if (!busy) return;
    const id = setTimeout(() => setBusy(null), COOLDOWN_MS);
    return () => clearTimeout(id);
  }, [busy]);

  if (!canAdd || !context || titles.length === 0) return null;

  const log = (title: string) => {
    if (busy) return;
    setBusy(title);
    createActivity(context, { ...emptyFormValues('note'), title });
    setLastLogged(title);
    onLogged?.(title);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text variant="caption" muted>
        Quick notes
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {titles.map((title) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            accessibilityLabel={`Log note: ${title}`}
            disabled={busy !== null}
            onPress={() => log(title)}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH_TARGET,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: colors.accent,
              backgroundColor: busy === title ? colors.surfaceMuted : colors.surface,
              opacity: pressed || (busy !== null && busy !== title) ? 0.6 : 1,
            })}
          >
            <Icon name="note" size={18} />
            <Text style={{ fontWeight: '600' }}>{title}</Text>
          </Pressable>
        ))}
      </View>
      {lastLogged && busy ? (
        <Text variant="caption" muted accessibilityLiveRegion="polite">
          Logged “{lastLogged}” just now
        </Text>
      ) : null}
    </View>
  );
}
