import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ActivityForm } from '@/components/activity/ActivityForm';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { emptyFormValues, type ActivityFormValues } from '@/features/activities/schemas';
import { useActivities, useActivityActions } from '@/hooks/useActivities';
import { toUserMessage } from '@/lib/errors';
import { ACTIVITY_META } from '@/lib/activity/meta';
import { createActivity, updateActivity } from '@/services/activities/activityService';
import {
  ACTIVITY_TYPES,
  BATH_TYPES,
  BREAST_SIDES,
  FEEDING_TYPES,
  isTimedType,
  type ActivityType,
} from '@/types/activity';

const MINUTE = 60_000;
const isType = (v: unknown): v is ActivityType => (ACTIVITY_TYPES as readonly unknown[]).includes(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  list.find((item) => item === v);

export default function ActivityFormScreen() {
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    past?: string;
    feedingType?: string;
    side?: string;
    bathType?: string;
  }>();
  const { activities } = useActivities();
  const { context, canAdd, canEdit, baby } = useActivityActions();
  const [error, setError] = useState<string | null>(null);

  const existing = params.id ? activities.find((a) => a.id === params.id) : undefined;
  const type: ActivityType | undefined = existing ? existing.type : isType(params.type) ? params.type : undefined;

  if (!baby || !context || !type) {
    return (
      <Screen topInset={false}>
        <Card>
          <Text variant="heading">Activity not found</Text>
          <Text muted>It may have been removed.</Text>
        </Card>
      </Screen>
    );
  }

  const allowed = existing ? canEdit(existing) : canAdd;
  if (!allowed) {
    return (
      <Screen topInset={false}>
        <Card>
          <Text variant="heading">View only</Text>
          <Text muted>Your role in this family room can’t {existing ? 'edit' : 'log'} this.</Text>
        </Card>
      </Screen>
    );
  }

  // "Log one that already happened": start a little while ago and end now.
  const now = Date.now();
  const initial: Partial<ActivityFormValues> =
    !existing && params.past && isTimedType(type)
      ? {
          startedAt: now - 15 * MINUTE,
          endedAt: now,
          feedingType: oneOf(FEEDING_TYPES, params.feedingType) ?? emptyFormValues(type).feedingType,
          side: oneOf(BREAST_SIDES, params.side),
          bathType: oneOf(BATH_TYPES, params.bathType) ?? emptyFormValues(type).bathType,
        }
      : {};

  const submit = (values: ActivityFormValues, photoUri: string | null) => {
    setError(null);
    try {
      if (existing) updateActivity(context, existing, values, photoUri);
      else createActivity(context, values, photoUri);
      router.back();
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  const meta = ACTIVITY_META[type];
  return (
    <Screen topInset={false}>
      <Stack.Screen options={{ title: `${meta.emoji} ${existing ? 'Edit' : 'Log'} ${meta.label.toLowerCase()}` }} />
      <ActivityForm
        key={existing?.id ?? `new-${type}`}
        type={type}
        activity={existing}
        initial={initial}
        submitLabel={existing ? 'Save changes' : 'Save'}
        onSubmit={submit}
        error={error}
      />
    </Screen>
  );
}
