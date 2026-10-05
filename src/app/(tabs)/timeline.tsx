import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, View } from 'react-native';

import { ActivityRow } from '@/components/activity/ActivityRow';
import { SyncBanner } from '@/components/SyncBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useActivities, useActivityActions } from '@/hooks/useActivities';
import { useNow } from '@/hooks/useNow';
import { useEnabledTypes, useTimeZone } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { groupByDay } from '@/lib/activity/group';
import { ACTIVITY_META } from '@/lib/activity/meta';
import type { ActivityType } from '@/types/activity';

type Filter = 'all' | ActivityType;

export default function TimelineScreen() {
  const { colors } = useTheme();
  const { activities, loading, days, canLoadOlder, loadOlder } = useActivities();
  const { baby, canAdd } = useActivityActions();
  const enabled = useEnabledTypes();
  const zone = useTimeZone();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<Filter>('all');

  // A filter for a type the user has since turned off would show nothing, so fall back to all.
  const activeFilter: Filter = filter === 'all' || enabled.includes(filter) ? filter : 'all';

  const sections = useMemo(
    () => groupByDay(activities, zone, now, activeFilter === 'all' ? enabled : [activeFilter]),
    [activities, zone, now, activeFilter, enabled],
  );

  if (!baby) {
    return (
      <Screen>
        <Text variant="title">Timeline</Text>
        <Card>
          <Text variant="heading">No baby yet</Text>
          <Text muted>Add your baby from the home screen to see their day here.</Text>
        </Card>
      </Screen>
    );
  }

  const header = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <Text variant="title">Timeline</Text>
      <SyncBanner />
      <ChoiceChips<Filter>
        options={[
          { value: 'all', label: 'All' },
          ...enabled.map((type) => ({ value: type as Filter, label: ACTIVITY_META[type].label.split(' /')[0] ?? '' })),
        ]}
        value={activeFilter}
        onChange={(v) => setFilter(v ?? 'all')}
      />
    </View>
  );

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={{ padding: 24, gap: 12 }}>
          {header}
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: 24, gap: 8, flexGrow: 1 }}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <Text variant="heading" style={{ marginTop: 12, marginBottom: 4 }} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <ActivityRow
            activity={item}
            zone={zone}
            now={now}
            onPress={() => router.push({ pathname: '/activity/detail', params: { id: item.id } })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Card>
            <Text variant="heading">
              {activities.length === 0 ? 'No activities yet' : 'Nothing matches this filter'}
            </Text>
            <Text muted>
              {activities.length === 0
                ? `Start tracking ${baby.name}’s day by logging the first activity.`
                : `No ${activeFilter === 'all' ? '' : ACTIVITY_META[activeFilter].label.toLowerCase() + ' '}activities in the last ${days} days.`}
            </Text>
            {activities.length === 0 && canAdd ? (
              <Button
                label="Log activity"
                onPress={() => router.push({ pathname: '/activity/start', params: { type: 'feeding' } })}
              />
            ) : null}
          </Card>
        }
        ListFooterComponent={
          canLoadOlder ? (
            <View style={{ paddingTop: 16 }}>
              <Text variant="caption" muted style={{ textAlign: 'center', marginBottom: 8 }}>
                Showing the last {days} days
              </Text>
              <Button label="Load earlier days" variant="secondary" onPress={loadOlder} />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
