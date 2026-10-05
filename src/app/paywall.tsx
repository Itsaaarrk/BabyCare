import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { PlanCard } from '@/components/billing/PlanCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useRooms } from '@/hooks/useRooms';
import { PLAN_NAME, PLAY_SUBSCRIPTIONS_URL, PREMIUM_FEATURES, type PlanChoice } from '@/lib/billing/config';
import { trackEvent, type BillingEvent } from '@/lib/billing/events';
import { formatPrice, paywallPrices, yearlySavings } from '@/lib/billing/pricing';

const SELECTED_EVENT: Record<PlanChoice, BillingEvent> = {
  monthly: 'plus_monthly_selected',
  yearly: 'plus_yearly_selected',
  lifetime: 'lifetime_selected',
};

export default function PaywallScreen() {
  const { current } = useRooms();
  // Nothing is preselected: the person chooses, and "Continue" waits for that.
  const [choice, setChoice] = useState<PlanChoice | null>(null);

  useEffect(() => trackEvent('paywall_viewed'), []);

  // Google Play's prices replace these once billing is connected.
  const prices = paywallPrices();
  const savings = yearlySavings(prices.monthly, prices.yearly);
  const benefits = Object.values(PREMIUM_FEATURES).filter((feature) => feature.launched);

  const choose = (plan: PlanChoice) => {
    setChoice(plan);
    trackEvent(SELECTED_EVENT[plan]);
  };

  return (
    <Screen topInset={false}>
      <View style={{ gap: 4 }}>
        <Text variant="title">{PLAN_NAME}</Text>
        <Text muted>
          {current ? `For ${current.info.name}. ` : ''}One plan covers everyone in the family room.
        </Text>
      </View>

      <Card>
        <Text variant="heading">What you get</Text>
        {benefits.map((feature) => (
          <View key={feature.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="check" size={18} />
            <Text style={{ flexShrink: 1 }}>{feature.label}</Text>
          </View>
        ))}
        <Text variant="caption" muted>
          Everything you can do today in BabyCare stays free. Your babies, activities and photos are
          never deleted, even if a plan ends.
        </Text>
      </Card>

      <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
        <PlanCard
          title="Monthly"
          price={`${formatPrice(prices.monthly)} / month`}
          billing="Recurring subscription. Renews every month until you cancel."
          selected={choice === 'monthly'}
          onPress={() => choose('monthly')}
        />
        <PlanCard
          title="Yearly"
          price={`${formatPrice(prices.yearly)} / year`}
          billing="Recurring subscription. Renews every year until you cancel."
          detail={
            savings
              ? `Save ${formatPrice({ amountMicros: savings.savedMicros, currency: prices.yearly.currency })} (${savings.percent}%) compared with twelve monthly payments. That works out to ${formatPrice({ amountMicros: savings.perMonthMicros, currency: prices.yearly.currency })} a month.`
              : undefined
          }
          badge={{ label: 'Best value', icon: 'star' }}
          selected={choice === 'yearly'}
          onPress={() => choose('yearly')}
        />
        <PlanCard
          title="Lifetime"
          price={`${formatPrice(prices.lifetime)} one time`}
          billing="One-time purchase. Not a subscription: no renewal, no recurring charge."
          detail="Unlocks the same features for this family room permanently. Photo storage still has an allowance."
          badge={{ label: 'Pay once', icon: 'diamond' }}
          selected={choice === 'lifetime'}
          onPress={() => choose('lifetime')}
        />
      </View>

      {/* Purchases arrive with the Google Play release. Until then this button must not look like it works. */}
      <Button label="Continue" onPress={() => undefined} disabled />
      <Text variant="caption" muted accessibilityLiveRegion="polite">
        Purchases open with the Google Play release. Nothing can be bought yet and nothing is charged.
      </Text>
      <Button label="Restore purchases" variant="secondary" onPress={() => undefined} disabled />
      <Button
        label="Manage subscriptions in Google Play"
        variant="secondary"
        onPress={() => void Linking.openURL(PLAY_SUBSCRIPTIONS_URL)}
      />
    </Screen>
  );
}
