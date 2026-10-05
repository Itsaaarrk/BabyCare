import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BarChart } from '@/components/analytics/BarChart';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { DateField } from '@/components/ui/DateField';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useBabies } from '@/hooks/useBabies';
import { useRangeActivities } from '@/hooks/useRangeActivities';
import { useEnabledTypes, useTimeZone } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatDuration } from '@/lib/activity/duration';
import { ACTIVITY_META } from '@/lib/activity/meta';
import { dailySeries, summarize, type DayBucket, type Summary } from '@/lib/activity/summary';
import { dayCount, rangeFor, type RangePreset } from '@/lib/date/range';
import { dayKey, startOfDay } from '@/lib/date/zone';
import type { ActivityType } from '@/types/activity';

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

type Filter = 'all' | ActivityType;

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { current } = useBabies();
  const zone = useTimeZone();
  const enabled = useEnabledTypes();
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [filter, setFilter] = useState<Filter>('all');
  const todayKey = dayKey(Date.now(), zone);
  const [from, setFrom] = useState(() => dayKey(startOfDay(Date.now(), zone) - 6 * 86_400_000, zone));
  const [to, setTo] = useState(todayKey);

  const range = useMemo(
    () => rangeFor(preset, Date.now(), zone, { from, to }),
    // The window moves with the clock, so recompute when the day or the choices change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, zone, from, to, todayKey],
  );
  const { activities, loading, partial } = useRangeActivities(range);
  const now = Date.now();
  const summary = useMemo(() => summarize(activities, now), [activities, now]);

  const activeFilter: Filter = filter === 'all' || enabled.includes(filter) ? filter : 'all';
  const shown = activeFilter === 'all' ? enabled : [activeFilter];
  const days = range ? dayCount(range) : 0;

  const label = (ms: number) =>
    new Intl.DateTimeFormat(undefined, { timeZone: zone, month: 'short', day: 'numeric' }).format(new Date(ms));
  const dayLabel = (bucketStart: number) =>
    days <= 7
      ? new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'short' }).format(new Date(bucketStart))
      : label(bucketStart);

  if (!current) {
    return (
      <Screen>
        <Text variant="title">Analytics</Text>
        <Card>
          <Text variant="heading">No baby yet</Text>
          <Text muted>Add your baby from the home screen to see trends here.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">Analytics</Text>

      <ChoiceChips options={PRESETS} value={preset} onChange={(v) => v && setPreset(v)} />

      {preset === 'custom' ? (
        <View style={{ gap: 8 }}>
          <DateField label="From" mode="date" value={from} onChange={setFrom} maximumDate={new Date()} />
          <DateField label="To" mode="date" value={to} onChange={setTo} maximumDate={new Date()} />
          {!range ? (
            <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
              Choose a start on or before the end, within about four months.
            </Text>
          ) : null}
        </View>
      ) : null}

      <ChoiceChips<Filter>
        label="Show"
        options={[
          { value: 'all', label: 'All' },
          ...enabled.map((type) => ({ value: type as Filter, label: ACTIVITY_META[type].label.split(' /')[0] ?? '' })),
        ]}
        value={activeFilter}
        onChange={(v) => setFilter(v ?? 'all')}
      />

      {range ? (
        <Text muted accessibilityLiveRegion="polite">
          {days === 1 ? label(range.start) : `${label(range.start)} – ${label(range.end - 1)}`} · {current.name}
        </Text>
      ) : null}

      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {partial ? (
        <Card>
          <Text muted>
            You’re offline, so this only includes the most recent days. Reconnect to see the full range.
          </Text>
        </Card>
      ) : null}

      {range && !loading && activities.length === 0 ? (
        <Card>
          <Text variant="heading">Nothing logged in this period</Text>
          <Text muted>Try a longer range, or log an activity from the home screen.</Text>
        </Card>
      ) : null}

      {range && activities.length > 0
        ? shown.map((type) => (
            <TypeCard
              key={type}
              type={type}
              summary={summary}
              series={(metric) => dailySeries(activities, type, metric, range.start, range.end, zone, now)}
              dayLabel={(b) => dayLabel(b.start)}
            />
          ))
        : null}

      {range && summary.caregivers.length > 0 && activeFilter === 'all' ? (
        <Card>
          <Text variant="heading">Who logged</Text>
          {summary.caregivers.map((c) => (
            <View key={c.uid} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text>{c.name}</Text>
              <Text muted>{c.count} logs</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text muted>{label}</Text>
      <Text style={{ fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

interface TypeCardProps {
  type: ActivityType;
  summary: Summary;
  series: (metric: 'count' | 'seconds') => ReturnType<typeof dailySeries>;
  dayLabel: (bucket: DayBucket) => string;
}

function TypeCard({ type, summary: s, series, dayLabel }: TypeCardProps) {
  const meta = ACTIVITY_META[type];
  const count = (n: number) => String(n);
  let body: React.ReactNode = null;
  let chart: React.ReactNode = null;

  switch (type) {
    case 'feeding':
      if (s.feeding.count === 0) return <Empty emoji={meta.emoji} label={meta.label} />;
      body = (
        <>
          <Stat label="Sessions" value={count(s.feeding.count)} />
          <Stat label="Total time" value={formatDuration(s.feeding.totalSeconds)} />
          <Stat label="Average length" value={formatDuration(s.feeding.averageSeconds)} />
          <Stat
            label="Average gap between feeds"
            value={s.feeding.averageIntervalSeconds === null ? '—' : formatDuration(s.feeding.averageIntervalSeconds)}
          />
        </>
      );
      chart = <BarChart title="Feeds per day" buckets={series('count')} format={count} dayLabel={dayLabel} />;
      break;
    case 'diaper':
      if (s.diaper.total === 0) return <Empty emoji={meta.emoji} label={meta.label} />;
      body = (
        <>
          <Stat label="Total" value={count(s.diaper.total)} />
          <Stat label="Pee" value={count(s.diaper.pee)} />
          <Stat label="Poop" value={count(s.diaper.poop)} />
          <Stat label="Pee + Poop" value={count(s.diaper.both)} />
          <Stat label="Dry" value={count(s.diaper.dry)} />
        </>
      );
      chart = <BarChart title="Diapers per day" buckets={series('count')} format={count} dayLabel={dayLabel} />;
      break;
    case 'sleep':
      if (s.sleep.count === 0) return <Empty emoji={meta.emoji} label={meta.label} />;
      body = (
        <>
          <Stat label="Total sleep" value={formatDuration(s.sleep.totalSeconds)} />
          <Stat label="Sessions" value={count(s.sleep.count)} />
          <Stat label="Average session" value={formatDuration(s.sleep.averageSeconds)} />
        </>
      );
      chart = <BarChart title="Sleep per day" buckets={series('seconds')} format={formatDuration} dayLabel={dayLabel} />;
      break;
    case 'bath':
      if (s.bath.count === 0) return <Empty emoji={meta.emoji} label={meta.label} />;
      body = (
        <>
          <Stat label="Baths" value={count(s.bath.count)} />
          <Stat label="Total time" value={formatDuration(s.bath.totalSeconds)} />
        </>
      );
      break;
    case 'outdoor':
      if (s.outdoor.count === 0) return <Empty emoji={meta.emoji} label={meta.label} />;
      body = (
        <>
          <Stat label="Total time" value={formatDuration(s.outdoor.totalSeconds)} />
          <Stat label="Times outdoors" value={count(s.outdoor.count)} />
        </>
      );
      chart = <BarChart title="Outdoor time per day" buckets={series('seconds')} format={formatDuration} dayLabel={dayLabel} />;
      break;
    case 'note':
      if (s.notes.count === 0) return <Empty emoji={meta.emoji} label={meta.label} />;
      body = <Stat label="Notes" value={count(s.notes.count)} />;
      break;
  }

  return (
    <Card>
      <Text variant="heading">
        {meta.emoji} {meta.label}
      </Text>
      {body}
      {chart}
    </Card>
  );
}

function Empty({ emoji, label }: { emoji: string; label: string }) {
  return (
    <Card>
      <Text variant="heading">
        {emoji} {label}
      </Text>
      <Text muted>Nothing logged in this period.</Text>
    </Card>
  );
}
