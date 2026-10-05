import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatDuration } from '@/lib/activity/duration';
import { ACTIVITY_META } from '@/lib/activity/meta';
import type { Summary } from '@/lib/activity/summary';
import type { ActivityType } from '@/types/activity';

/** One-line description of a type's totals, e.g. "8 sessions · 2h 18m". */
export function summaryLine(type: ActivityType, s: Summary): string {
  const sessions = (n: number) => `${n} ${n === 1 ? 'session' : 'sessions'}`;
  switch (type) {
    case 'feeding':
      return s.feeding.count === 0 ? 'None yet' : `${sessions(s.feeding.count)} · ${formatDuration(s.feeding.totalSeconds)}`;
    case 'diaper': {
      const d = s.diaper;
      if (d.total === 0) return 'None yet';
      const parts = [`${d.total} total`];
      if (d.pee) parts.push(`${d.pee} pee`);
      if (d.poop) parts.push(`${d.poop} poop`);
      if (d.both) parts.push(`${d.both} both`);
      return parts.join(' · ');
    }
    case 'sleep':
      return s.sleep.count === 0 ? 'None yet' : `${sessions(s.sleep.count)} · ${formatDuration(s.sleep.totalSeconds)}`;
    case 'bath':
      return s.bath.count === 0 ? 'None yet' : `${sessions(s.bath.count)} · ${formatDuration(s.bath.totalSeconds)}`;
    case 'outdoor':
      return s.outdoor.count === 0 ? 'None yet' : formatDuration(s.outdoor.totalSeconds);
    case 'note':
      return s.notes.count === 0 ? 'None yet' : `${s.notes.count} ${s.notes.count === 1 ? 'note' : 'notes'}`;
  }
}

interface Props {
  summary: Summary;
  /** Types to show, in order. */
  types: readonly ActivityType[];
  onPress?: () => void;
}

/** Compact "today" tiles for the home screen. */
export function SummaryCards({ summary, types, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {types.map((type) => {
        const meta = ACTIVITY_META[type];
        const line = summaryLine(type, summary);
        return (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={`${meta.label} today: ${line}`}
            onPress={onPress}
            style={{
              width: '48%',
              padding: 14,
              gap: 2,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Text variant="caption" muted>
              {meta.emoji} {meta.label}
            </Text>
            <Text style={{ fontWeight: '600' }}>{line}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
