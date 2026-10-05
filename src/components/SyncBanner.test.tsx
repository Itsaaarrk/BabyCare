import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useConnectionStore } from '@/stores/connectionStore';
import { useSyncStore } from '@/stores/syncStore';
import type { ActivityOp } from '@/lib/activity/ops';

import { SyncBanner } from './SyncBanner';

jest.mock('@/services/activities/writeQueue', () => ({ flushQueue: jest.fn() }));

const op = (id: string): ActivityOp => ({
  opId: id,
  kind: 'delete',
  roomId: 'r',
  babyId: 'b',
  id,
  queuedAt: 1,
});

beforeEach(() => {
  jest.useFakeTimers();
  useConnectionStore.setState({ online: true });
  useSyncStore.setState({ ops: [], failed: [], ownerUid: null });
});
afterEach(() => jest.useRealTimers());

describe('SyncBanner', () => {
  it('is invisible when online with nothing waiting', () => {
    render(<SyncBanner />);
    expect(screen.toJSON()).toBeNull();
  });

  it('reports waiting changes while online', () => {
    useSyncStore.setState({ ops: [op('a'), op('b')] });
    render(<SyncBanner />);
    expect(screen.getByText('Syncing 2 changes…')).toBeOnTheScreen();
  });

  it('waits a moment before announcing offline, then explains what will happen', () => {
    useSyncStore.setState({ ops: [op('a')] });
    useConnectionStore.setState({ online: false });
    render(<SyncBanner />);
    expect(screen.queryByText(/Offline/)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(3100);
    });
    expect(screen.getByText('Offline · 1 change will sync when you’re back online')).toBeOnTheScreen();
  });

  it('says so when offline with nothing waiting', () => {
    useConnectionStore.setState({ online: false });
    render(<SyncBanner />);
    act(() => {
      jest.advanceTimersByTime(3100);
    });
    expect(screen.getByText(/Offline · showing saved data/)).toBeOnTheScreen();
  });

  it('offers retry and discard when the server rejected changes', () => {
    useSyncStore.setState({ failed: [op('x')] });
    render(<SyncBanner />);
    expect(screen.getByText('1 change couldn’t be saved')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(useSyncStore.getState().failed).toHaveLength(0);
    expect(useSyncStore.getState().ops).toHaveLength(1);
  });

  it('can discard failed changes', () => {
    useSyncStore.setState({ failed: [op('x'), op('y')] });
    render(<SyncBanner />);
    fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    expect(useSyncStore.getState().failed).toHaveLength(0);
    expect(useSyncStore.getState().ops).toHaveLength(0);
  });
});
