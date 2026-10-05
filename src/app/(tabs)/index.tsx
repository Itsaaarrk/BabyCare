import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ActiveTimerCard } from '@/components/activity/ActiveTimerCard';
import { QuickActionGrid } from '@/components/activity/QuickActionGrid';
import { SummaryCards } from '@/components/activity/SummaryCards';
import { BabyAvatar } from '@/components/baby/BabyAvatar';
import { SyncBanner } from '@/components/SyncBanner';
import { IconText } from '@/components/ui/IconText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { useActivities, useActivityActions } from '@/hooks/useActivities';
import { useBabies } from '@/hooks/useBabies';
import { useNow } from '@/hooks/useNow';
import { useSettings, useTimeZone } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatAgo } from '@/lib/activity/duration';
import { ACTIVITY_META, activityDetailLine, activityTitle } from '@/lib/activity/meta';
import { inRange, latestOfType, runningTimers, summarize } from '@/lib/activity/summary';
import { formatAge } from '@/lib/date/age';
import { addDays, formatClock, startOfDay } from '@/lib/date/zone';
import { visibleTypes } from '@/lib/settings';
import { finishActivity } from '@/services/activities/activityService';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { babies, loading, current, select } = useBabies();
  const { activities, loading: activitiesLoading } = useActivities();
  const { context, canAdd, canEdit } = useActivityActions();
  const { settings } = useSettings();
  const zone = useTimeZone();
  // Refresh "x min ago" and the day boundary twice a minute.
  const now = useNow(30_000);

  const todayStart = startOfDay(now, zone);
  const summary = useMemo(
    () => summarize(inRange(activities, todayStart, addDays(todayStart, 1, zone)), now),
    [activities, todayStart, zone, now],
  );
  const timers = useMemo(() => runningTimers(activities), [activities]);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen>
        <SyncBanner />
        <Text variant="title">Welcome</Text>
        <Card>
          <Text variant="heading">Add your baby</Text>
          <Text muted>
            Create a profile to start tracking feeds, diapers, sleep and more with your family.
          </Text>
        </Card>
        <Button label="Add your baby" onPress={() => router.push('/baby/new')} />
        <Button label="Join a family room" variant="secondary" onPress={() => router.push('/join')} />
      </Screen>
    );
  }

  const lastFeed = latestOfType(activities, 'feeding');
  const lastDiaper = latestOfType(activities, 'diaper');
  const lastActivity = activities[0];
  const cardTypes = visibleTypes(settings.dashboardCardOrder, settings.enabledActivities).filter(
    (t) => settings.dashboardCardVisible[t],
  );
  const runningTypes = timers.map((t) => t.type);

  return (
    <Screen>
      <SyncBanner />

      {babies.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {babies.map((baby) => {
            const selected = baby.id === current.id && baby.roomId === current.roomId;
            return (
              <Pressable
                key={`${baby.roomId}/${baby.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${baby.name}`}
                onPress={() => select({ roomId: baby.roomId, babyId: baby.id })}
                style={{
                  minHeight: MIN_TOUCH_TARGET,
                  paddingHorizontal: 18,
                  justifyContent: 'center',
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                }}
              >
                <Text style={{ fontWeight: selected ? '700' : '400' }}>{baby.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Card style={{ alignItems: 'center', paddingVertical: 20, gap: 4 }}>
        <BabyAvatar size={88} photoPath={current.photoPath} label={`${current.name}'s photo`} />
        <Text variant="title">{current.name}</Text>
        <Text variant="heading" muted>
          {formatAge(current.birthDate)}
        </Text>
        <View style={{ marginTop: 6, gap: 2, alignItems: 'center' }}>
          <Text muted>Last feed: {lastFeed ? formatAgo(lastFeed.startedAt, now) : '—'}</Text>
          <Text muted>Last diaper: {lastDiaper ? formatAgo(lastDiaper.startedAt, now) : '—'}</Text>
        </View>
      </Card>

      {timers.map((timer) => (
        <ActiveTimerCard
          key={timer.id}
          activity={timer}
          canFinish={!!context && canEdit(timer)}
          onFinish={() => context && finishActivity(context, timer)}
          onPress={() => router.push({ pathname: '/activity/detail', params: { id: timer.id } })}
        />
      ))}

      {canAdd ? (
        <QuickActionGrid
          running={runningTypes}
          onSelect={(type) => router.push({ pathname: '/activity/start', params: { type } })}
        />
      ) : (
        <Card>
          <Text muted>You can view {current.name}’s day but not log activities.</Text>
        </Card>
      )}

      {activitiesLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : activities.length === 0 ? (
        <Card>
          <Text variant="heading">No activities yet</Text>
          <Text muted>Start tracking {current.name}’s day by logging the first activity.</Text>
          {canAdd ? (
            <Button
              label="Log activity"
              onPress={() => router.push({ pathname: '/activity/start', params: { type: 'feeding' } })}
            />
          ) : null}
        </Card>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Text variant="heading">Today</Text>
            <SummaryCards summary={summary} types={cardTypes} onPress={() => router.push('/summary')} />
          </View>

          {lastActivity ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open the last activity"
              onPress={() => router.push({ pathname: '/activity/detail', params: { id: lastActivity.id } })}
            >
              <Card>
                <Text variant="caption" muted>
                  Last activity
                </Text>
                <IconText icon={lastActivity.type} variant="heading">
                  {activityTitle(lastActivity)}
                </IconText>
                <Text muted>
                  {formatClock(lastActivity.startedAt, zone)} · {lastActivity.createdByName}
                  {activityDetailLine(lastActivity) ? ` · ${activityDetailLine(lastActivity)}` : ''}
                </Text>
              </Card>
            </Pressable>
          ) : null}

          <Button label="See the day’s summary" variant="secondary" onPress={() => router.push('/summary')} />
        </>
      )}
    </Screen>
  );
}
