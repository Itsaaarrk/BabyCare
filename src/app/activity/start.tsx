import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActiveTimerCard } from '@/components/activity/ActiveTimerCard';
import { Icon } from '@/components/ui/Icon';
import { IconText } from '@/components/ui/IconText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { emptyFormValues, type ActivityFormValues } from '@/features/activities/schemas';
import { useActivities, useActivityActions } from '@/hooks/useActivities';
import { useTheme } from '@/hooks/useTheme';
import { ACTIVITY_META, BATH_TYPE_LABELS, DIAPER_TYPE_LABELS, FEEDING_TYPE_LABELS } from '@/lib/activity/meta';
import { runningTimers } from '@/lib/activity/summary';
import { createActivity, finishActivity } from '@/services/activities/activityService';
import {
  ACTIVITY_TYPES,
  BATH_TYPES,
  BREAST_SIDES,
  DIAPER_TYPES,
  FEEDING_TYPES,
  type ActivityType,
  type BathType,
  type BreastSide,
  type FeedingType,
} from '@/types/activity';

const isType = (v: unknown): v is ActivityType => (ACTIVITY_TYPES as readonly unknown[]).includes(v);

export default function StartActivityScreen() {
  const { type: rawType } = useLocalSearchParams<{ type?: string }>();
  const type: ActivityType = isType(rawType) ? rawType : 'note';
  const meta = ACTIVITY_META[type];
  const { colors } = useTheme();
  const { activities } = useActivities();
  const { context, canAdd, canEdit, baby } = useActivityActions();

  const [feedingType, setFeedingType] = useState<FeedingType | undefined>('breast');
  const [side, setSide] = useState<BreastSide | undefined>();
  const [bathType, setBathType] = useState<BathType | undefined>('night');
  // Stops a quick double tap from logging twice.
  const [saved, setSaved] = useState(false);

  const running = runningTimers(activities).find((a) => a.type === type);

  const title = <Stack.Screen options={{ title: meta.label }} />;

  if (!baby || !context) {
    return (
      <Screen topInset={false}>
        {title}
        <Card>
          <Text variant="heading">Add a baby first</Text>
          <Text muted>Activities are logged for a baby. Add one from the home screen.</Text>
        </Card>
      </Screen>
    );
  }

  if (!canAdd) {
    return (
      <Screen topInset={false}>
        {title}
        <Card>
          <Text variant="heading">View only</Text>
          <Text muted>Your role in this family room can’t log activities.</Text>
        </Card>
      </Screen>
    );
  }

  const save = (overrides: Partial<ActivityFormValues>) => {
    if (saved) return;
    setSaved(true);
    createActivity(context, { ...emptyFormValues(type), ...overrides });
    router.back();
  };

  if (type === 'note') {
    // Notes always need words, so go straight to the form.
    return <Redirect href={{ pathname: '/activity/form', params: { type } }} />;
  }

  if (running) {
    return (
      <Screen topInset={false}>
        {title}
        <Text muted>Already running — finish it, then you can start another.</Text>
        <ActiveTimerCard
          activity={running}
          canFinish={canEdit(running)}
          onFinish={() => {
            finishActivity(context, running);
            router.back();
          }}
        />
        <Button
          label="Edit times or details"
          variant="secondary"
          onPress={() => router.replace({ pathname: '/activity/form', params: { id: running.id } })}
        />
      </Screen>
    );
  }

  if (type === 'diaper') {
    return (
      <Screen topInset={false}>
        {title}
        <Text muted>One tap logs it right now.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {DIAPER_TYPES.map((diaperType) => (
            <Pressable
              key={diaperType}
              accessibilityRole="button"
              accessibilityLabel={`Log diaper: ${DIAPER_TYPE_LABELS[diaperType]}`}
              disabled={saved}
              onPress={() => save({ diaperType })}
              style={({ pressed }) => ({
                width: '47%',
                minHeight: 110,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.lg,
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderColor: colors.accent,
                opacity: pressed || saved ? 0.7 : 1,
              })}
            >
              <Icon name="diaper" size={34} />
              <Text variant="heading">{DIAPER_TYPE_LABELS[diaperType]}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          label="Add a time, note or photo instead"
          variant="secondary"
          onPress={() => router.replace({ pathname: '/activity/form', params: { type } })}
        />
      </Screen>
    );
  }

  return (
    <Screen topInset={false}>
      {title}
      <View style={{ gap: 4 }}>
        <IconText icon={type} variant="title" size={30}>
          {meta.label}
        </IconText>
        <Text muted>Start a timer now, or log one that already happened.</Text>
      </View>

      {type === 'feeding' ? (
        <>
          <ChoiceChips
            label="Feeding type"
            options={FEEDING_TYPES.map((value) => ({ value, label: FEEDING_TYPE_LABELS[value] }))}
            value={feedingType}
            onChange={setFeedingType}
          />
          {feedingType === 'breast' ? (
            <ChoiceChips
              label="Side (optional)"
              options={BREAST_SIDES.map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))}
              value={side}
              onChange={setSide}
              clearable
            />
          ) : null}
        </>
      ) : null}

      {type === 'bath' ? (
        <ChoiceChips
          label="Bath type"
          options={BATH_TYPES.map((value) => ({ value, label: BATH_TYPE_LABELS[value].replace(' bath', '') }))}
          value={bathType}
          onChange={setBathType}
        />
      ) : null}

      <Button
        label={`Start ${meta.label.toLowerCase().split(' ')[0]}`}
        disabled={saved || (type === 'feeding' && !feedingType)}
        onPress={() =>
          save({
            ...(type === 'feeding' && { feedingType, side: feedingType === 'breast' ? side : undefined }),
            ...(type === 'bath' && { bathType }),
          })
        }
      />
      <Button
        label="Log one that already happened"
        variant="secondary"
        onPress={() =>
          router.replace({
            pathname: '/activity/form',
            params: {
              type,
              past: '1',
              ...(feedingType && { feedingType }),
              ...(side && { side }),
              ...(bathType && { bathType }),
            },
          })
        }
      />
    </Screen>
  );
}
