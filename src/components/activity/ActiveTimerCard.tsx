import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useNow } from '@/hooks/useNow';
import { useTimeZone } from '@/hooks/useSettings';
import { formatDurationLong, formatTimer } from '@/lib/activity/duration';
import { ACTIVITY_META, activityDetailLine } from '@/lib/activity/meta';
import { formatClock } from '@/lib/date/zone';
import type { Activity } from '@/types/activity';

interface Props {
  activity: Activity;
  /** Whether the viewer may end this timer. */
  canFinish: boolean;
  onFinish: () => void;
  onPress?: () => void;
}

/** A running timer, e.g. "Sleeping 01:24:12", with a button to end it. */
export function ActiveTimerCard({ activity, canFinish, onFinish, onPress }: Props) {
  const now = useNow(1000);
  const meta = ACTIVITY_META[activity.type];
  const zone = useTimeZone();
  const seconds = Math.max(0, (now - activity.startedAt) / 1000);
  const detail = activityDetailLine(activity);

  return (
    <Card>
      {/* Only this header opens the details, so pressing the finish button below can't also navigate. */}
      <Pressable
        disabled={!onPress}
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : 'timer'}
        accessibilityLabel={`${meta.running} for ${formatDurationLong(seconds)}`}
        accessibilityHint={onPress ? 'Opens the details' : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Text style={{ fontSize: 36 }}>{meta.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text variant="heading">{meta.running}</Text>
          <Text muted>
            Since {formatClock(activity.startedAt, zone)}
            {detail ? ` · ${detail}` : ''}
          </Text>
          <Text muted>Started by {activity.createdByName}</Text>
        </View>
        <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
          {formatTimer(seconds)}
        </Text>
      </Pressable>
      {canFinish ? <Button label={meta.finish} onPress={onFinish} /> : null}
      {activity.pending ? (
        <Text variant="caption" muted>
          Waiting to sync…
        </Text>
      ) : null}
    </Card>
  );
}
