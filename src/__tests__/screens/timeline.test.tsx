import { router } from 'expo-router';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useActivities, useActivityActions } from '@/hooks/useActivities';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { useSettingsStore } from '@/stores/settingsStore';

import { freezeClock, makeActivity } from '../../../jest.fixtures';
import TimelineScreen from '@/app/(tabs)/timeline';

jest.mock('@/hooks/useActivities', () => ({ useActivities: jest.fn(), useActivityActions: jest.fn() }));
jest.mock('@/services/activities/writeQueue', () => ({ flushQueue: jest.fn() }));

const NOW = new Date(2026, 9, 4, 15, 0);
const HOUR = 3_600_000;
const mockActivities = useActivities as jest.Mock;
const mockActions = useActivityActions as jest.Mock;

const feeding = makeActivity({
  type: 'feeding',
  startedAt: NOW.getTime() - 1 * HOUR,
  durationSeconds: 600,
  endedAt: NOW.getTime() - 1 * HOUR + 600_000,
  details: { feedingType: 'bottle', amount: 120, amountUnit: 'ml' },
  createdByName: 'Mom',
});
const diaper = makeActivity({
  type: 'diaper',
  startedAt: NOW.getTime() - 2 * HOUR,
  details: { diaperType: 'pee' },
  createdByName: 'Dad',
});
const yesterday = makeActivity({
  type: 'sleep',
  startedAt: NOW.getTime() - 26 * HOUR,
  durationSeconds: 3600,
  endedAt: NOW.getTime() - 25 * HOUR,
  createdByName: 'Mom',
});

function setup(activities = [feeding, diaper, yesterday], extra = {}) {
  mockActivities.mockReturnValue({
    activities,
    loading: false,
    days: 7,
    canLoadOlder: true,
    loadOlder: jest.fn(),
    ...extra,
  });
  mockActions.mockReturnValue({ baby: { id: 'baby1', name: 'Sofia' }, canAdd: true });
}

beforeAll(() => freezeClock(NOW));
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, revision: 0 });
});

describe('Timeline', () => {
  it('lists activities newest first under Today and Yesterday', () => {
    setup();
    render(<TimelineScreen />);
    expect(screen.getByText('Today')).toBeOnTheScreen();
    expect(screen.getByText('Yesterday')).toBeOnTheScreen();
    const rows = screen.getAllByRole('button').filter((b) => b.props.accessibilityHint === 'Opens the details');
    expect(rows.map((r) => (r.props.accessibilityLabel as string).split(',')[0])).toEqual([
      'Feeding',
      'Diaper · Pee',
      'Sleep',
    ]);
  });

  it('shows who logged each entry', () => {
    setup();
    render(<TimelineScreen />);
    expect(screen.getAllByText('Mom')).toHaveLength(2);
    expect(screen.getByText('Dad')).toBeOnTheScreen();
  });

  it('filters by activity type and back to all', () => {
    setup();
    render(<TimelineScreen />);

    fireEvent.press(screen.getByRole('radio', { name: 'Diaper' }));
    expect(screen.queryByLabelText(/^Feeding,/)).toBeNull();
    expect(screen.getByLabelText(/^Diaper · Pee,/)).toBeOnTheScreen();
    expect(screen.queryByText('Yesterday')).toBeNull();

    fireEvent.press(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByLabelText(/^Feeding,/)).toBeOnTheScreen();
  });

  it('says when a filter matches nothing', () => {
    setup([feeding]);
    render(<TimelineScreen />);
    fireEvent.press(screen.getByRole('radio', { name: 'Bath' }));
    expect(screen.getByText('Nothing matches this filter')).toBeOnTheScreen();
  });

  it('hides filters for activities the user turned off', () => {
    useSettingsStore.getState().update({
      enabledActivities: { ...DEFAULT_SETTINGS.enabledActivities, bath: false },
    });
    setup();
    render(<TimelineScreen />);
    expect(screen.queryByRole('radio', { name: 'Bath' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Feeding' })).toBeOnTheScreen();
  });

  it('opens the details of a tapped activity', () => {
    setup();
    render(<TimelineScreen />);
    fireEvent.press(screen.getByLabelText(/^Diaper · Pee,/));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/activity/detail', params: { id: diaper.id } });
  });

  it('shows a meaningful empty state with a way to log', () => {
    setup([]);
    render(<TimelineScreen />);
    expect(screen.getByText('No activities yet')).toBeOnTheScreen();
    expect(screen.getByText(/Start tracking Sofia’s day/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Log activity' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/activity/start', params: { type: 'feeding' } });
  });

  it('loads earlier days on request', () => {
    const loadOlder = jest.fn();
    setup(undefined, { loadOlder });
    render(<TimelineScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Load earlier days' }));
    expect(loadOlder).toHaveBeenCalledTimes(1);
  });

  it('shows a loading indicator, not a blank screen', () => {
    setup([], { loading: true });
    render(<TimelineScreen />);
    expect(screen.getByText('Timeline')).toBeOnTheScreen();
    expect(screen.queryByText('No activities yet')).toBeNull();
  });
});
