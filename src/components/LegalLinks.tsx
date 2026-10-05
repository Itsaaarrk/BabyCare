import { Linking, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { privacyPolicyUrl, termsUrl } from '@/lib/legal';

interface Props {
  privacy?: string;
  terms?: string;
}

/** Links to the privacy policy and terms. Shows nothing until their web addresses are set. */
export function LegalLinks({ privacy = privacyPolicyUrl, terms = termsUrl }: Props) {
  const { colors } = useTheme();
  const links = [
    { label: 'Privacy policy', url: privacy },
    { label: 'Terms of use', url: terms },
  ].filter((link) => link.url);
  if (links.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 }}>
      {links.map((link) => (
        <Pressable
          key={link.label}
          accessibilityRole="link"
          accessibilityLabel={link.label}
          onPress={() => void Linking.openURL(link.url)}
          style={{ minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' }}
        >
          <Text variant="caption" style={{ color: colors.accent, textDecorationLine: 'underline' }}>
            {link.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
