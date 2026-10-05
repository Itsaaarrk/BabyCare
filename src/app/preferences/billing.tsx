import { router } from 'expo-router';
import { Linking, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconText } from '@/components/ui/IconText';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useRoomPlan } from '@/hooks/useEntitlement';
import { useRooms } from '@/hooks/useRooms';
import { PLAN_NAME, PLAY_SUBSCRIPTIONS_URL } from '@/lib/billing/config';
import { PLAN_LABEL } from '@/lib/billing/entitlement';

const dateText = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

/** Settings → Subscription & Billing. Plan details are for the room's owner only. */
export default function BillingScreen() {
  const { current } = useRooms();
  const plan = useRoomPlan(current?.id);

  if (!current) {
    return (
      <Screen topInset={false}>
        <Card>
          <Text variant="heading">No family room yet</Text>
          <Text muted>Plans belong to a family room. Add your baby to create one.</Text>
        </Card>
      </Screen>
    );
  }

  const isOwner = current.role === 'owner';

  if (!plan.isPlus) {
    return (
      <Screen topInset={false}>
        <Card>
          <Text variant="heading">BabyCare Free</Text>
          <Text>You’re currently using the Free plan.</Text>
          <Text muted>
            Free covers everyday tracking for your family room. {PLAN_NAME} adds more babies and more over time.
          </Text>
          {isOwner ? (
            <Button label={`Upgrade to ${PLAN_NAME}`} onPress={() => router.push('/paywall')} />
          ) : (
            <Text muted>The family room’s owner can upgrade it.</Text>
          )}
        </Card>
      </Screen>
    );
  }

  // Everyone in the room sees that Plus is on. Plan and renewal details are only for the owner.
  if (!isOwner) {
    return (
      <Screen topInset={false}>
        <Card>
          <IconText icon="star" variant="heading">
            {PLAN_NAME}
          </IconText>
          <Text>This family room has {PLAN_NAME}.</Text>
          <Text muted>Premium is shared with all members of this family room.</Text>
        </Card>
      </Screen>
    );
  }

  const label = plan.plan === 'free' ? '' : PLAN_LABEL[plan.plan];
  const isLifetime = plan.plan === 'lifetime';

  return (
    <Screen topInset={false}>
      <Card>
        <IconText icon="star" variant="heading">
          {PLAN_NAME}
        </IconText>
        <Text variant="title">{label}</Text>

        <View style={{ gap: 2 }}>
          <Text muted>Status</Text>
          <Text>
            {plan.endsAtPeriodEnd
              ? 'Cancelled'
              : plan.status === 'grace_period'
                ? 'Payment issue'
                : 'Active'}
          </Text>
        </View>

        {isLifetime ? (
          <Text>One-time purchase. No renewal.</Text>
        ) : plan.endsAtPeriodEnd && plan.expiresAt ? (
          <Text>
            Active until {dateText(plan.expiresAt)}. You will not be charged again.
          </Text>
        ) : plan.status === 'grace_period' && plan.expiresAt ? (
          <Text>
            Google Play couldn’t take the latest payment. Update your payment method in Google Play to keep
            {' '}
            {PLAN_NAME}.
          </Text>
        ) : plan.expiresAt ? (
          <View style={{ gap: 2 }}>
            <Text muted>Next renewal</Text>
            <Text>{dateText(plan.expiresAt)}</Text>
          </View>
        ) : null}

        <Text variant="caption" muted>
          Premium is shared with all members of this family room.
        </Text>
      </Card>

      {!isLifetime ? (
        <Button
          label="Manage subscription"
          variant="secondary"
          onPress={() => void Linking.openURL(PLAY_SUBSCRIPTIONS_URL)}
        />
      ) : null}
      <Button label="Restore purchases" variant="secondary" onPress={() => undefined} disabled />
      <Text variant="caption" muted>
        Restoring purchases becomes available with the Google Play release.
      </Text>
    </Screen>
  );
}
