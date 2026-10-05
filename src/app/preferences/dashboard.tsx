import { Card } from '@/components/ui/Card';
import { ReorderList, moveItem } from '@/components/ui/ReorderList';
import { Screen } from '@/components/ui/Screen';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Text } from '@/components/ui/Text';
import { useSettings } from '@/hooks/useSettings';
import { ACTIVITY_META } from '@/lib/activity/meta';
import { ACTIVITY_TYPES, type ActivityType } from '@/types/activity';

export default function DashboardPreferencesScreen() {
  const { settings, update } = useSettings();

  return (
    <Screen topInset={false}>
      <Card>
        <Text variant="heading">Activities you track</Text>
        <Text muted>Turn off anything you don’t use. It disappears from every screen.</Text>
        {ACTIVITY_TYPES.map((type) => (
          <SwitchRow
            key={type}
            label={`${ACTIVITY_META[type].emoji}  ${ACTIVITY_META[type].label}`}
            value={settings.enabledActivities[type]}
            onValueChange={(value) =>
              update({ enabledActivities: { ...settings.enabledActivities, [type]: value } })
            }
          />
        ))}
      </Card>

      <Card>
        <Text variant="heading">Home summary cards</Text>
        <Text muted>Choose which totals appear under “Today”, and in what order.</Text>
        {settings.dashboardCardOrder.map((type) => (
          <SwitchRow
            key={type}
            label={`${ACTIVITY_META[type].emoji}  ${ACTIVITY_META[type].label}`}
            value={settings.dashboardCardVisible[type]}
            disabled={!settings.enabledActivities[type]}
            description={settings.enabledActivities[type] ? undefined : 'Turned off above'}
            onValueChange={(value) =>
              update({ dashboardCardVisible: { ...settings.dashboardCardVisible, [type]: value } })
            }
          />
        ))}
        <Text variant="caption" muted style={{ marginTop: 8 }}>
          Order
        </Text>
        <ReorderList
          items={settings.dashboardCardOrder.map((type: ActivityType) => ({
            key: type,
            label: ACTIVITY_META[type].label,
            emoji: ACTIVITY_META[type].emoji,
          }))}
          onMove={(index, direction) =>
            update({ dashboardCardOrder: moveItem(settings.dashboardCardOrder, index, direction) })
          }
        />
      </Card>
    </Screen>
  );
}
