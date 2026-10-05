import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { InviteCard } from '@/components/family/InviteCard';
import { MemberRow } from '@/components/family/MemberRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { useRooms } from '@/hooks/useRooms';
import { useTheme } from '@/hooks/useTheme';
import { toUserMessage } from '@/lib/errors';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { deleteRoom, removeMember } from '@/services/rooms/roomService';
import { useAuthStore } from '@/stores/authStore';

export default function FamilyScreen() {
  const { colors } = useTheme();
  const uid = useAuthStore((s) => s.user?.uid);
  const { rooms, current, loading, showRoom } = useRooms();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen>
        <Text variant="title">Family</Text>
        <Card>
          <Text variant="heading">No family room yet</Text>
          <Text muted>
            Add your baby to start a family room, or join one with a code from a family member.
          </Text>
        </Card>
        <Button label="Add your baby" onPress={() => router.push('/baby/new')} />
        <Button label="Join with a code" variant="secondary" onPress={() => router.push('/join')} />
      </Screen>
    );
  }

  const role = current.role;
  const isOwner = role === 'owner';
  const members = [...(current.members ?? [])].sort(
    (a, b) => Number(b.role === 'owner') - Number(a.role === 'owner') || a.joinedAt - b.joinedAt,
  );

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmLeave = () =>
    Alert.alert(
      `Leave ${current.info.name}?`,
      'You will no longer see this baby. You can rejoin with a new invitation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => uid && void run(() => removeMember(current.id, uid, true)),
        },
      ],
    );

  const confirmDelete = () =>
    Alert.alert(
      `Delete ${current.info.name}?`,
      'This permanently removes the room, its baby profiles and photos for everyone. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete room', style: 'destructive', onPress: () => void run(() => deleteRoom(current.id)) },
      ],
    );

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text variant="title">{current.info.name}</Text>
        <Text muted>
          Created by {current.info.ownerName || 'the owner'}
          {role ? ` · You are ${role === 'owner' ? 'the owner' : `a ${ROLE_LABELS[role].toLowerCase()}`}` : ''}
        </Text>
      </View>

      {rooms.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {rooms.map((room) => {
            const selected = room.id === current.id;
            return (
              <Pressable
                key={room.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${room.info.name}`}
                onPress={() => showRoom(room.id)}
                style={{
                  minHeight: MIN_TOUCH_TARGET,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.accent : colors.border,
                  backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                }}
              >
                <Text style={{ fontWeight: selected ? '700' : '400' }}>{room.info.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {role && can(role, 'invite') ? (
        <InviteCard
          key={current.id}
          roomId={current.id}
          roomName={current.info.name}
          role={role}
          invite={current.invite}
        />
      ) : null}

      <View style={{ gap: 8 }}>
        <Text variant="heading">Members</Text>
        {members.length === 0 ? <ActivityIndicator color={colors.accent} /> : null}
        {members.map((member) => (
          <MemberRow
            key={`${current.id}/${member.uid}`}
            roomId={current.id}
            member={member}
            isSelf={member.uid === uid}
            manageable={isOwner && member.role !== 'owner'}
            onError={setError}
          />
        ))}
      </View>

      {error ? (
        <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button label="Join another room" variant="secondary" onPress={() => router.push('/join')} />
      {isOwner ? (
        <Button label="Delete room" variant="danger" onPress={confirmDelete} loading={busy} />
      ) : (
        <Button label="Leave room" variant="danger" onPress={confirmLeave} loading={busy} />
      )}
    </Screen>
  );
}
