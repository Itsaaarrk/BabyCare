import { Card } from '@/components/ui/Card';
import { ReorderList, moveItem } from '@/components/ui/ReorderList';
import { Screen } from '@/components/ui/Screen';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Text } from '@/components/ui/Text';
import { useSettings } from '@/hooks/useSettings';
import { ACTIVITY_META } from '@/lib/activity/meta';

export default function QuickLoggingScreen() {
  const { settings, update } = useSettings();

  return (
    <Screen topInset={false}>
      <Card>
        <Text variant="heading">Quick-action buttons</Text>
        <Text muted>Put the ones you use most first. Turn buttons off under Dashboard.</Text>
        <ReorderList
          items={settings.quickActionOrder.map((type) => ({
            key: type,
            label: `${ACTIVITY_META[type].label}${settings.enabledActivities[type] ? '' : ' (off)'}`,
            emoji: ACTIVITY_META[type].emoji,
          }))}
          onMove={(index, direction) =>
            update({ quickActionOrder: moveItem(settings.quickActionOrder, index, direction) })
          }
        />
      </Card>

      <Card>
        <Text variant="heading">Shake to log</Text>
        <SwitchRow
          label="Open Quick Log when I shake the phone"
          description="Off by default. The buttons on the home screen always work; this is only a shortcut. It needs a few firm shakes, so walking or a bumpy stroller won’t trigger it."
          value={settings.shakeToLog}
          onValueChange={(shakeToLog) => update({ shakeToLog })}
        />
      </Card>
    </Screen>
  );
}
