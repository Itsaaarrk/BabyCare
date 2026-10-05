import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { missingFirebaseKeys } from '@/lib/env';

/** Shown instead of the app when Firebase environment variables are missing. */
export function SetupRequired() {
  return (
    <Screen>
      <Text variant="title">Almost there</Text>
      <Text muted>
        BabyCare needs its Firebase configuration. Copy .env.example to .env, fill in the values
        from the Firebase console, then restart the dev server.
      </Text>
      <Card>
        <Text variant="caption" muted>
          Missing values
        </Text>
        {missingFirebaseKeys.map((key) => (
          <Text key={key}>{key}</Text>
        ))}
      </Card>
    </Screen>
  );
}
