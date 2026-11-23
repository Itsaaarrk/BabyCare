import { useMemo } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useRangeActivities } from '@/hooks/useRangeActivities';
import { useTimeZone } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { buildInsights, type Insight } from '@/lib/activity/insights';
import { addDays, startOfDay } from '@/lib/date/zone';

const MARK: Record<Insight['kind'], string> = { trend: '↕', pattern: '•', nudge: '✎' };

/** This week at a glance, compared with the week before. Always the last 14 days, whatever range is shown. */
export function InsightsCard() {
  const { colors } = useTheme();
  const zone = useTimeZone();
  const now = Date.now();
  const today = startOfDay(now, zone);
  // Whole days, so the range (and the one fetch for the older week) only changes at midnight.
  const range = useMemo(
    () => ({ start: addDays(today, -14, zone), end: addDays(today, 1, zone) }),
    [today, zone],
  );
  const { activities, loading } = useRangeActivities(range);
  const insights = useMemo(() => buildInsights(activities, now), [activities, now]);

  if (loading && activities.length === 0) return null;

  return (
    <Card>
      <Text variant="heading">This week’s insights</Text>
      {insights.map((insight) => (
        <View key={insight.id} style={{ flexDirection: 'row', gap: 8 }}>
          <Text muted accessibilityElementsHidden importantForAccessibility="no">
            {MARK[insight.kind]}
          </Text>
          <Text style={{ flex: 1, color: insight.kind === 'nudge' ? colors.textMuted : colors.text }}>
            {insight.text}
          </Text>
        </View>
      ))}
      <Text variant="caption" muted>
        Based only on what your family logged. This isn’t medical advice. Talk to your pediatrician about any concerns.
      </Text>
    </Card>
  );
}
