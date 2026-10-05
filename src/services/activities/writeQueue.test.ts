import { remove, set, update } from 'firebase/database';

import { emptyFormValues, toActivityRecord } from '@/features/activities/schemas';
import type { ActivityOp } from '@/lib/activity/ops';
import { deletePhoto, uploadActivityPhoto } from '@/services/storage/photoService';
import { useSyncStore } from '@/stores/syncStore';

import { enqueue, flushQueue } from './writeQueue';

jest.mock('firebase/database', () => ({
  ref: jest.fn((_db: unknown, path: string) => ({ path })),
  set: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));
jest.mock('firebase/app', () => ({ FirebaseError: class FirebaseError extends Error {} }));
jest.mock('@/lib/firebase', () => ({ getFirebaseDatabase: jest.fn(() => ({})) }));
jest.mock('@/services/storage/photoService', () => ({
  uploadActivityPhoto: jest.fn(),
  deletePhoto: jest.fn(),
}));

const mockSet = set as jest.Mock;
const mockUpdate = update as jest.Mock;
const mockRemove = remove as jest.Mock;
const mockUpload = uploadActivityPhoto as jest.Mock;

const record = toActivityRecord(emptyFormValues('sleep', Date.now() - 60_000), { uid: 'ana', name: 'Ana' });
let n = 0;
const base = (id: string) => ({ opId: `op${++n}`, roomId: 'r', babyId: 'b', id, queuedAt: n });
const ops = () => useSyncStore.getState().ops;
const failed = () => useSyncStore.getState().failed;

beforeEach(() => {
  jest.clearAllMocks();
  mockSet.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
  useSyncStore.setState({ ops: [], failed: [], ownerUid: 'ana' });
});

describe('write queue', () => {
  it('sends operations in order and empties the queue', async () => {
    const calls: string[] = [];
    mockSet.mockImplementation(async () => void calls.push('set'));
    mockUpdate.mockImplementation(async () => void calls.push('update'));
    mockRemove.mockImplementation(async () => void calls.push('remove'));
    useSyncStore.setState({
      ops: [
        { ...base('a1'), kind: 'set', record },
        { ...base('a1'), kind: 'update', patch: { notes: 'x' } },
        { ...base('a1'), kind: 'delete' },
      ] as ActivityOp[],
    });
    await flushQueue();
    expect(calls).toEqual(['set', 'update', 'remove']);
    expect(ops()).toHaveLength(0);
    expect(failed()).toHaveLength(0);
  });

  it('writes to the right place with the right data', async () => {
    useSyncStore.setState({ ops: [{ ...base('a1'), kind: 'set', record }] as ActivityOp[] });
    await flushQueue();
    expect(mockSet).toHaveBeenCalledWith({ path: 'rooms/r/babies/b/activities/a1' }, record);
  });

  it('keeps an operation queued until the server confirms it, so offline writes simply wait', async () => {
    let confirm: () => void = () => undefined;
    mockSet.mockImplementation(() => new Promise<void>((resolve) => (confirm = resolve)));
    enqueue({ ...base('a1'), kind: 'set', record });
    await Promise.resolve();
    expect(ops()).toHaveLength(1);
    confirm();
    await new Promise((r) => setTimeout(r, 0));
    expect(ops()).toHaveLength(0);
  });

  it('is safe to replay: the same operation twice sends identical writes', async () => {
    const op = { ...base('a1'), kind: 'set', record } as ActivityOp;
    useSyncStore.setState({ ops: [op] });
    await flushQueue();
    useSyncStore.setState({ ops: [op] });
    await flushQueue();
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet.mock.calls[0]).toEqual(mockSet.mock.calls[1]);
  });

  it('moves a rejected operation, and later ones on the same activity, to failed', async () => {
    mockSet.mockRejectedValueOnce({ code: 'PERMISSION_DENIED' });
    useSyncStore.setState({
      ops: [
        { ...base('a1'), kind: 'set', record },
        { ...base('a1'), kind: 'update', patch: { notes: 'x' } },
        { ...base('a2'), kind: 'delete' },
      ] as ActivityOp[],
    });
    await flushQueue();
    expect(failed().map((o) => o.kind)).toEqual(['set', 'update']);
    // An unrelated activity still goes through.
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(ops()).toHaveLength(0);
  });

  it('retries failed operations when asked', async () => {
    mockSet.mockRejectedValueOnce({ code: 'PERMISSION_DENIED' });
    useSyncStore.setState({ ops: [{ ...base('a1'), kind: 'set', record }] as ActivityOp[] });
    await flushQueue();
    expect(failed()).toHaveLength(1);

    useSyncStore.getState().retryFailed();
    await flushQueue();
    expect(failed()).toHaveLength(0);
    expect(ops()).toHaveLength(0);
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it('uploads a photo and then records its path on the activity', async () => {
    mockUpload.mockResolvedValue('rooms/r/babies/b/activities/a1/photo.jpg');
    useSyncStore.setState({
      ops: [{ ...base('a1'), kind: 'photo', localUri: 'file:///p.jpg', attempts: 0 }] as ActivityOp[],
    });
    await flushQueue();
    expect(mockUpload).toHaveBeenCalledWith('r', 'b', 'a1', 'file:///p.jpg');
    expect(mockUpdate).toHaveBeenCalledWith(
      { path: 'rooms/r/babies/b/activities/a1' },
      expect.objectContaining({ photoPath: 'rooms/r/babies/b/activities/a1/photo.jpg' }),
    );
    expect(ops()).toHaveLength(0);
  });

  it('retries a flaky photo upload without blocking other changes, then gives up', async () => {
    mockUpload.mockRejectedValue({ code: 'storage/retry-limit-exceeded' });
    useSyncStore.setState({
      ops: [
        { ...base('a1'), kind: 'photo', localUri: 'file:///p.jpg', attempts: 0 },
        { ...base('a2'), kind: 'delete' },
      ] as ActivityOp[],
    });
    await flushQueue();
    expect(mockUpload).toHaveBeenCalledTimes(4);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(failed().map((o) => o.kind)).toEqual(['photo']);
  });

  it('does not retry a photo the server refused', async () => {
    mockUpload.mockRejectedValue({ code: 'storage/unauthorized' });
    useSyncStore.setState({
      ops: [{ ...base('a1'), kind: 'photo', localUri: 'file:///p.jpg', attempts: 0 }] as ActivityOp[],
    });
    await flushQueue();
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(failed()).toHaveLength(1);
  });

  it('removes the stored photo when an activity is deleted', async () => {
    useSyncStore.setState({
      ops: [{ ...base('a1'), kind: 'delete', photoPath: 'rooms/r/x.jpg' }] as ActivityOp[],
    });
    await flushQueue();
    expect(deletePhoto).toHaveBeenCalledWith('rooms/r/x.jpg');
  });

  it('forgets another user queued changes when a different user signs in', () => {
    useSyncStore.setState({ ops: [{ ...base('a1'), kind: 'delete' }] as ActivityOp[], ownerUid: 'ana' });
    useSyncStore.getState().claim('ana');
    expect(ops()).toHaveLength(1);
    useSyncStore.getState().claim('dad');
    expect(ops()).toHaveLength(0);
    expect(useSyncStore.getState().ownerUid).toBe('dad');
  });
});
