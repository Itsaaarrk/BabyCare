import { useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { RoleChips } from '@/components/family/RoleChips';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { toUserMessage } from '@/lib/errors';
import { joinLink } from '@/lib/joinCode';
import { ROLE_DESCRIPTIONS, invitableRoles, type AssignableRole } from '@/lib/permissions';
import { regenerateInvite, revokeInvite } from '@/services/rooms/roomService';
import type { RoomInvite, RoomRole } from '@/types/baby';

interface Props {
  roomId: string;
  roomName: string;
  role: RoomRole;
  invite: RoomInvite | null | undefined;
}

function expiryText(expiresAt: number): string {
  const msLeft = expiresAt - Date.now();
  if (msLeft <= 0) return 'Expired. Make a new code.';
  const days = Math.floor(msLeft / 86_400_000);
  if (days >= 1) return `Expires in ${days} ${days === 1 ? 'day' : 'days'}`;
  return `Expires in ${Math.max(1, Math.round(msLeft / 3_600_000))} hr`;
}

export function InviteCard({ roomId, roomName, role, invite }: Props) {
  const { colors } = useTheme();
  const roles = invitableRoles(role);
  const [chosenRole, setChosenRole] = useState<AssignableRole | null>(null);
  const [busy, setBusy] = useState<'create' | 'stop' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRole: AssignableRole =
    chosenRole ?? (invite && roles.includes(invite.role) ? invite.role : (roles[0] ?? 'caregiver'));

  const run = async (kind: 'create' | 'stop', action: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const expired = invite ? invite.expiresAt <= Date.now() : false;

  return (
    <Card>
      <Text variant="heading">Invite someone</Text>
      <Text muted>They can scan the QR code or type the code in the app.</Text>

      <Text variant="caption" muted style={{ marginTop: 8 }}>
        They will join as
      </Text>
      <RoleChips roles={roles} value={selectedRole} onChange={setChosenRole} disabled={busy !== null} />
      <Text variant="caption" muted>
        {ROLE_DESCRIPTIONS[selectedRole]}
      </Text>

      {invite ? (
        <View style={{ alignItems: 'center', gap: 12, marginTop: 8 }}>
          <View
            style={{ padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF' }}
            accessible
            accessibilityLabel={`QR code to join ${roomName}`}
          >
            <QRCode value={joinLink(invite.code)} size={180} color="#000000" backgroundColor="#FFFFFF" />
          </View>
          <Text
            variant="title"
            style={{ letterSpacing: 6, fontVariant: ['tabular-nums'] }}
            selectable
            accessibilityLabel={`Join code ${invite.code.split('').join(' ')}`}
          >
            {invite.code}
          </Text>
          <Text variant="caption" style={{ color: expired ? colors.danger : colors.textMuted }}>
            {expiryText(invite.expiresAt)} · joins as {invite.role}
          </Text>
        </View>
      ) : (
        <Text muted style={{ marginTop: 8 }}>
          Sharing is off. Create a code to invite someone.
        </Text>
      )}

      {error ? (
        <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {invite && !expired ? (
        <Button
          label="Share code"
          onPress={() =>
            void Share.share({
              message: `Join ${roomName} on BabyCare.\nCode: ${invite.code}\n${joinLink(invite.code)}`,
            })
          }
        />
      ) : null}
      <Button
        label={invite ? 'Make a new code' : 'Create invite code'}
        variant={invite && !expired ? 'secondary' : 'primary'}
        loading={busy === 'create'}
        disabled={busy !== null}
        onPress={() => run('create', () => regenerateInvite(roomId, selectedRole))}
      />
      {invite ? (
        <Button
          label="Stop sharing"
          variant="secondary"
          loading={busy === 'stop'}
          disabled={busy !== null}
          onPress={() => run('stop', () => revokeInvite(roomId))}
        />
      ) : null}
    </Card>
  );
}
