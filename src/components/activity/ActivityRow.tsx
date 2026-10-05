import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { formatDuration, formatDurationLong } from '@/lib/activity/duration';
import { ACTIVITY_META, activityDetailLine, activityTitle } from '@/lib/activity/meta';
import { activitySeconds } from '@/lib/activity/summary';
import { formatClock } from '@/lib/date/zone';
import { isTimedType, type Activity } from '@/types/activity';

interface Props {
  activity: Activity;
  zone: string;
  now: number;
  onPress: () => void;
}

/** One entry in the timeline: icon, title, time, duration, details and who logged it. */
export function ActivityRow({ activity, zone, now, onPress }: Props) {
  const { colors } = useTheme();
  const meta = ACTIVITY_META[activity.type];
  const timed = isTimedType(activity.type);
  const running = timed && activity.endedAt === undefined;
  const seconds = timed ? activitySeconds(activity, now) : 0;
  const detail = activityDetailLine(activity);
  const time = formatClock(activity.startedAt, zone);
  const durationText = timed ? (running ? 'In progress' : formatDuration(seconds)) : '';

  const label = [
    activityTitle(activity),
    time,
    timed ? (running ? 'in progress' : formatDurationLong(seconds)) : '',
    detail,
    `logged by ${activity.createdByName}`,
    activity.photoPath ? 'has a photo' : '',
    activity.pending ? 'waiting to sync' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the details"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_TARGET + 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ fontSize: 28 }}>{meta.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }} numberOfLines={1}>
          {activityTitle(activity)}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {time}
          {durationText ? ` · ${durationText}` : ''}
          {detail ? ` · ${detail}` : ''}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {activity.createdByName}
          {activity.pending ? ' · waiting to sync' : ''}
        </Text>
      </View>
      {activity.photoPath ? <Text accessibilityElementsHidden>📷</Text> : null}
    </Pressable>
  );
}
