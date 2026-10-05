import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconText } from '@/components/ui/IconText';
import { Text } from '@/components/ui/Text';
import { billingEnabled, PLAN_NAME } from '@/lib/billing/config';

interface Props {
  title: string;
  /** What the person gets, in plain words. Never just "locked". */
  description: string;
}

/**
 * Shown instead of a feature the room's plan doesn't include. It says what the feature is and where
 * it comes from, rather than quietly disabling a button.
 */
export function LockedFeature({ title, description }: Props) {
  return (
    <Card>
      <IconText icon="lock" variant="heading">
        {title}
      </IconText>
      <Text>{description}</Text>
      <Text muted>Available with {PLAN_NAME}.</Text>
      {billingEnabled ? (
        <Button label={`View ${PLAN_NAME} plans`} variant="secondary" onPress={() => router.push('/paywall')} />
      ) : null}
    </Card>
  );
}
