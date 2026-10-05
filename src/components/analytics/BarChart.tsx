import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import type { DayBucket } from '@/lib/activity/summary';

interface Props {
  title: string;
  buckets: readonly DayBucket[];
  /** Formats a value for labels and screen readers, e.g. "8" or "2h 18m". */
  format: (value: number) => string;
  /** Short label for a bucket's day, e.g. "Mon" or "Oct 3". */
  dayLabel: (bucket: DayBucket) => string;
}

const CHART_HEIGHT = 110;

/**
 * Plain bars, one per day, with the largest value written out. No chart library: it keeps the
 * app small and each bar can carry a readable label for screen readers.
 */
export function BarChart({ title, buckets, format, dayLabel }: Props) {
  const { colors } = useTheme();
  const max = Math.max(...buckets.map((b) => b.value), 0);
  if (buckets.length < 2) return null;

  // With many days, label only a handful so the axis stays legible.
  const step = Math.ceil(buckets.length / 7);

  return (
    <View
      style={{ gap: 6 }}
      accessible
      accessibilityLabel={`${title}. ${buckets.map((b) => `${dayLabel(b)}: ${format(b.value)}`).join('. ')}`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" muted>
          {title}
        </Text>
        <Text variant="caption" muted>
          Most: {format(max)}
        </Text>
      </View>
      <View style={{ height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: buckets.length > 31 ? 1 : 4 }}>
        {buckets.map((bucket) => (
          <View key={bucket.key} style={{ flex: 1, height: CHART_HEIGHT, justifyContent: 'flex-end' }}>
            <View
              style={{
                height: max === 0 ? 0 : Math.max(bucket.value > 0 ? 3 : 0, (bucket.value / max) * CHART_HEIGHT),
                borderRadius: 3,
                backgroundColor: colors.accent,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: buckets.length > 31 ? 1 : 4 }}>
        {buckets.map((bucket, i) => (
          <View key={bucket.key} style={{ flex: 1, alignItems: 'center' }}>
            {i % step === 0 ? (
              <Text variant="caption" muted numberOfLines={1} style={{ fontSize: 10 }}>
                {dayLabel(bucket)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
