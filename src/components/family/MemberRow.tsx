import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { RoleChips } from '@/components/family/RoleChips';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { toUserMessage } from '@/lib/errors';
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AssignableRole } from '@/lib/permissions';
import { removeMember, setMemberRole } from '@/services/rooms/roomService';
import type { RoomMember } from '@/types/baby';

interface Props {
  roomId: string;
  member: RoomMember;
  isSelf: boolean;
  /** True when the viewer is the owner looking at someone else. */
  manageable: boolean;
  onError: (message: string | null) => void;
}

export function MemberRow({ roomId, member, isSelf, manageable, onError }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    onError(null);
    try {
      await action();
    } catch (e) {
      onError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = () =>
    Alert.alert(
      `Remove ${member.displayName}?`,
      'They will lose access to this family room straight away.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void run(() => removeMember(roomId, member.uid, false)),
        },
      ],
    );

  const label = `${member.displayName}${isSelf ? ' (you)' : ''}, ${ROLE_LABELS[member.role]}`;

  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Pressable
        accessibilityRole={manageable ? 'button' : 'text'}
        accessibilityLabel={manageable ? `${label}. Manage` : label}
        accessibilityState={{ expanded: manageable ? open : undefined }}
        disabled={!manageable}
        onPress={() => setOpen((v) => !v)}
        style={{
          minHeight: MIN_TOUCH_TARGET + 8,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontWeight: '600' }}>
          {member.displayName}
          {isSelf ? ' (you)' : ''}
        </Text>
        <Text muted>
          {ROLE_LABELS[member.role]}
          {manageable ? (open ? '  ▲' : '  ▼') : ''}
        </Text>
      </Pressable>

      {manageable && open ? (
        <View style={{ padding: 14, paddingTop: 0, gap: 10 }}>
          <Text variant="caption" muted>
            Role
          </Text>
          <RoleChips
            roles={ASSIGNABLE_ROLES}
            value={member.role === 'owner' ? 'parent' : (member.role as AssignableRole)}
            disabled={busy}
            onChange={(role) => void run(() => setMemberRole(roomId, member.uid, role))}
          />
          <Button label="Remove from room" variant="danger" onPress={confirmRemove} loading={busy} />
        </View>
      ) : null}
    </View>
  );
}
