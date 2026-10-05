import { router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { ActivityPhoto } from '@/components/activity/ActivityPhoto';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useActivities, useActivityActions } from '@/hooks/useActivities';
import { useNow } from '@/hooks/useNow';
import { useTimeZone } from '@/hooks/useSettings';
import { formatDuration, formatDurationLong, formatTimer } from '@/lib/activity/duration';
import { ACTIVITY_META, activityDetailLine, activityTitle } from '@/lib/activity/meta';
import { activitySeconds } from '@/lib/activity/summary';
import { dayKey, formatClock } from '@/lib/date/zone';
import { deleteActivity, finishActivity } from '@/services/activities/activityService';
import { isRunning, isTimedType } from '@/types/activity';

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activities } = useActivities();
  const { context, canEdit, canDelete } = useActivityActions();
  const zone = useTimeZone();
  const activity = activities.find((a) => a.id === id);
  const running = activity ? isRunning(activity) : false;
  const now = useNow(1000, running);

  if (!activity || !context) {
    return (
      <Screen topInset={false}>
        <Card>
          <Text variant="heading">Activity not found</Text>
          <Text muted>It may have been deleted.</Text>
        </Card>
      </Screen>
    );
  }

  const meta = ACTIVITY_META[activity.type];
  const seconds = activitySeconds(activity, now);
  const detail = activityDetailLine(activity);
  const sameDay = activity.endedAt !== undefined && dayKey(activity.endedAt, zone) === dayKey(activity.startedAt, zone);
  const day = new Intl.DateTimeFormat(undefined, { timeZone: zone, dateStyle: 'full' }).format(new Date(activity.startedAt));

  const confirmDelete = () =>
    Alert.alert('Delete this activity?', 'This removes it for everyone in the family room.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteActivity(context, activity);
          router.back();
        },
      },
    ]);

  return (
    <Screen topInset={false}>
      <View style={{ gap: 4 }}>
        <Text variant="title">
          {meta.emoji} {activityTitle(activity)}
        </Text>
        <Text muted>{day}</Text>
      </View>

      <Card>
        <Row label="Time">
          {formatClock(activity.startedAt, zone)}
          {activity.endedAt !== undefined
            ? ` – ${formatClock(activity.endedAt, zone)}${sameDay ? '' : ' (next day)'}`
            : running
              ? ' – now'
              : ''}
        </Row>
        {isTimedType(activity.type) ? (
          <Row label="Duration">
            <Text accessibilityLabel={formatDurationLong(seconds)}>
              {running ? formatTimer(seconds) : formatDuration(seconds)}
              {running ? ' (running)' : ''}
            </Text>
          </Row>
        ) : null}
        {detail ? <Row label="Details">{detail}</Row> : null}
        <Row label="Logged by">{activity.createdByName}</Row>
        {activity.updatedAt > activity.createdAt ? (
          <Row label="Last edited">{`${formatClock(activity.updatedAt, zone)}`}</Row>
        ) : null}
        {activity.pending ? <Row label="Sync">Waiting to sync…</Row> : null}
      </Card>

      {activity.notes ? (
        <Card>
          <Text variant="caption" muted>
            Notes
          </Text>
          <Text>{activity.notes}</Text>
        </Card>
      ) : null}

      {activity.photoPath ? <ActivityPhoto photoPath={activity.photoPath} /> : null}

      {running && canEdit(activity) ? (
        <Button
          label={meta.finish}
          onPress={() => {
            finishActivity(context, activity);
            router.back();
          }}
        />
      ) : null}
      {canEdit(activity) ? (
        <Button
          label="Edit"
          variant="secondary"
          onPress={() => router.push({ pathname: '/activity/form', params: { id: activity.id } })}
        />
      ) : null}
      {canDelete(activity) ? <Button label="Delete" variant="danger" onPress={confirmDelete} /> : null}
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text muted>{label}</Text>
      <Text style={{ flexShrink: 1, textAlign: 'right' }}>{children}</Text>
    </View>
  );
}
