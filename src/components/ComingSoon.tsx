import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';

interface Props {
  title: string;
  description: string;
}

/** Placeholder body for tabs whose features land in later phases. */
export function ComingSoon({ title, description }: Props) {
  return (
    <Screen>
      <Text variant="title">{title}</Text>
      <Card>
        <Text variant="heading">Coming soon</Text>
        <Text muted>{description}</Text>
      </Card>
    </Screen>
  );
}
