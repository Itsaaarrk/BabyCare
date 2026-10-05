import { onValue, ref } from 'firebase/database';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { useBabies } from '@/hooks/useBabies';
import { useTimeZone } from '@/hooks/useSettings';
import { applyOps } from '@/lib/activity/ops';
import { addDays, startOfDay } from '@/lib/date/zone';
import { getFirebaseDatabase } from '@/lib/firebase';
import { can } from '@/lib/permissions';
import type { ActivityContext } from '@/services/activities/activityService';
import { subscribeToActivities } from '@/services/activities/activitySync';
import { flushQueue } from '@/services/activities/writeQueue';
import { useActivityStore, MAX_DAYS } from '@/stores/activityStore';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSyncStore } from '@/stores/syncStore';
import type { Activity } from '@/types/activity';

/**
 * Keeps the selected baby's recent activities live, tracks the connection, and sends queued
 * changes whenever there is a chance to. Mount once, at the root.
 */
export function useAppSync(): void {
  const uid = useAuthStore((s) => s.user?.uid);
  const { current } = useBabies();
  const zone = useTimeZone();
  const days = useActivityStore((s) => s.days);
  const roomId = current?.roomId;
  const babyId = current?.id;

  // One user's queued changes must never be sent as another user.
  useEffect(() => {
    if (uid) useSyncStore.getState().claim(uid);
  }, [uid]);

  useEffect(() => {
    if (!uid || !roomId || !babyId) {
      useActivityStore.getState().open(null);
      return;
    }
    const key = `${roomId}/${babyId}`;
    useActivityStore.getState().open(key);
    const since = addDays(startOfDay(Date.now(), zone), -(days - 1), zone);
    return subscribeToActivities(
      roomId,
      babyId,
      since,
      (items) => useActivityStore.getState().setSnapshot(key, items),
      () => undefined,
    );
  }, [uid, roomId, babyId, zone, days]);

  // Forget everything on sign-out so the next person starts clean.
  useEffect(() => {
    if (uid) return;
    useActivityStore.getState().reset();
    useSyncStore.getState().clear();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onValue(ref(getFirebaseDatabase(), '.info/connected'), (snapshot) => {
      const online = snapshot.val() === true;
      useConnectionStore.getState().setOnline(online);
      if (online) void flushQueue();
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    void flushQueue();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushQueue();
    });
    return () => subscription.remove();
  }, [uid]);
}

/** The selected baby's activities, newest first, including changes not yet synced. */
export function useActivities() {
  const { current } = useBabies();
  const key = current ? `${current.roomId}/${current.id}` : null;
  const serverKey = useActivityStore((s) => s.key);
  const items = useActivityStore((s) => s.items);
  const synced = useActivityStore((s) => s.synced);
  const days = useActivityStore((s) => s.days);
  const loadOlderRaw = useActivityStore((s) => s.loadOlder);
  const ops = useSyncStore((s) => s.ops);

  const activities = useMemo<Activity[]>(() => {
    if (!current || serverKey !== key) return [];
    const merged = applyOps(items, ops, current.roomId, current.id);
    return Object.values(merged).sort((a, b) => b.startedAt - a.startedAt);
  }, [current, key, serverKey, items, ops]);

  const hasLocalData = Object.keys(items).length > 0;
  const loadOlder = useCallback(() => loadOlderRaw(), [loadOlderRaw]);

  return {
    activities,
    /** True only when there's nothing to show yet, not even an offline copy. */
    loading: !!current && !synced && !hasLocalData,
    days,
    canLoadOlder: days < MAX_DAYS,
    loadOlder,
  };
}

/** Who may do what for the selected baby, plus the context needed to write activities. */
export function useActivityActions() {
  const { current } = useBabies();
  const user = useAuthStore((s) => s.user);
  const role = current?.role;

  const context = useMemo<ActivityContext | null>(
    () =>
      current && user
        ? {
            roomId: current.roomId,
            babyId: current.id,
            actor: { uid: user.uid, name: user.displayName?.trim() || 'Family member' },
          }
        : null,
    [current, user],
  );

  return {
    baby: current,
    context,
    role,
    uid: user?.uid,
    canAdd: can(role, 'addActivity'),
    canEdit: (activity: Activity) =>
      can(role, 'editAnyActivity') ||
      (role === 'caregiver' && activity.createdBy === user?.uid) ||
      // Caregivers may finish a running timer someone else started.
      (role === 'caregiver' && activity.endedAt === undefined && activity.type !== 'diaper' && activity.type !== 'note'),
    canDelete: (activity: Activity) =>
      can(role, 'deleteAnyActivity') || (can(role, 'deleteOwnActivity') && activity.createdBy === user?.uid),
  };
}
