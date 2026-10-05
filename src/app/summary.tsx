import { useMemo, useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useBabies } from '@/hooks/useBabies';
import { useRangeActivities } from '@/hooks/useRangeActivities';
import { useSettings, useTimeZone } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatDuration } from '@/lib/activity/duration';
import { summarize } from '@/lib/activity/summary';
import { dailySummaryText } from '@/lib/activity/summaryText';
import { addDays, startOfDay } from '@/lib/date/zone';

/** "Sofia's day": the day's totals and who logged what, with day-by-day navigation. */
export default function DailySummaryScreen() {
  const { colors } = useTheme();
  const { current } = useBabies();
  const { settings } = useSettings();
  const zone = useTimeZone();
  const [offset, setOffset] = useState(0);

  const todayStart = startOfDay(Date.now(), zone);
  const dayStart = addDays(todayStart, offset, zone);
  const range = useMemo(() => ({ start: dayStart, end: addDays(dayStart, 1, zone) }), [dayStart, zone]);
  const { activities, loading } = useRangeActivities(range);
  const now = Date.now();
  const summary = useMemo(() => summarize(activities, now), [activities, now]);

  if (!current) {
    return (
      <Screen topInset={false}>
        <Card>
          <Text variant="heading">No baby yet</Text>
        </Card>
      </Screen>
    );
  }

  const dateLabel = new Intl.DateTimeFormat(undefined, { timeZone: zone, month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(dayStart),
  );
  const on = settings.enabledActivities;
  const text = dailySummaryText(current.name, dateLabel, summary, {
    feeding: on.feeding,
    diaper: on.diaper,
    sleep: on.sleep,
    bath: on.bath,
    outdoor: on.outdoor,
  });

  return (
    <Screen topInset={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="‹ Earlier" variant="secondary" onPress={() => setOffset((o) => o - 1)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Later ›" variant="secondary" onPress={() => setOffset((o) => o + 1)} disabled={offset >= 0} />
        </View>
      </View>

      <View style={{ gap: 2 }}>
        <Text variant="title">{current.name}’s day</Text>
        <Text muted>{offset === 0 ? `Today · ${dateLabel}` : dateLabel}</Text>
      </View>

      {loading ? <ActivityIndicator color={colors.accent} /> : null}

      {!loading && summary.total === 0 ? (
        <Card>
          <Text variant="heading">Nothing logged</Text>
          <Text muted>No activities on this day.</Text>
        </Card>
      ) : null}

      {summary.total > 0 ? (
        <>
          {on.feeding ? (
            <Section emoji="🍼" title="Feeding">
              <Text>{summary.feeding.count} {summary.feeding.count === 1 ? 'session' : 'sessions'}</Text>
              <Text muted>{formatDuration(summary.feeding.totalSeconds)} total</Text>
            </Section>
          ) : null}
          {on.diaper ? (
            <Section emoji="🧷" title="Diapers">
              <Text>{summary.diaper.total} total</Text>
              <Text muted>
                {[
                  summary.diaper.pee && `${summary.diaper.pee} pee`,
                  summary.diaper.poop && `${summary.diaper.poop} poop`,
                  summary.diaper.both && `${summary.diaper.both} pee + poop`,
                  summary.diaper.dry && `${summary.diaper.dry} dry`,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </Text>
            </Section>
          ) : null}
          {on.sleep ? (
            <Section emoji="😴" title="Sleep">
              <Text>{summary.sleep.count} {summary.sleep.count === 1 ? 'session' : 'sessions'}</Text>
              <Text muted>{formatDuration(summary.sleep.totalSeconds)} total</Text>
            </Section>
          ) : null}
          {on.bath ? (
            <Section emoji="🛁" title="Bath">
              <Text>{summary.bath.count} {summary.bath.count === 1 ? 'session' : 'sessions'}</Text>
              <Text muted>{formatDuration(summary.bath.totalSeconds)}</Text>
            </Section>
          ) : null}
          {on.outdoor ? (
            <Section emoji="☀️" title="Outdoor">
              <Text>{formatDuration(summary.outdoor.totalSeconds)}</Text>
            </Section>
          ) : null}

          <Card>
            <Text variant="heading">Caregivers</Text>
            {summary.caregivers.map((c) => (
              <View key={c.uid} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{c.name}</Text>
                <Text muted>
                  {c.count} {c.count === 1 ? 'log' : 'logs'}
                </Text>
              </View>
            ))}
          </Card>

          <Button label="Share summary" variant="secondary" onPress={() => void Share.share({ message: text })} />
        </>
      ) : null}
    </Screen>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <Text variant="heading">
        {emoji} {title}
      </Text>
      {children}
    </Card>
  );
}
