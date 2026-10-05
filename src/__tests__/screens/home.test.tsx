import { router } from 'expo-router';
import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import { useActivities, useActivityActions } from '@/hooks/useActivities';
import { useBabies } from '@/hooks/useBabies';
import { toDateString } from '@/lib/date/age';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { useSettingsStore } from '@/stores/settingsStore';

import { freezeClock, makeActivity } from '../../../jest.fixtures';

jest.mock('@/hooks/useActivities', () => ({ useActivities: jest.fn(), useActivityActions: jest.fn() }));
jest.mock('@/hooks/useBabies', () => ({ useBabies: jest.fn() }));
jest.mock('@/components/baby/BabyAvatar', () => ({ BabyAvatar: () => null }));
jest.mock('@/services/activities/writeQueue', () => ({ flushQueue: jest.fn() }));
jest.mock('@/services/activities/activityService', () => ({ finishActivity: jest.fn() }));

const NOW = new Date(2026, 9, 4, 15, 0);
const MIN = 60_000;
const mockBabies = useBabies as jest.Mock;
const mockActivities = useActivities as jest.Mock;
const mockActions = useActivityActions as jest.Mock;

const sofia = {
  id: 'baby1',
  roomId: 'room1',
  name: 'Sofia',
  birthDate: toDateString(new Date(NOW.getTime() - 12 * 86_400_000)),
  createdAt: 1,
  role: 'owner',
};

interface Options {
  baby?: object | null;
  activities?: ReturnType<typeof makeActivity>[];
  canAdd?: boolean;
}

function setup({ baby = sofia, activities = [], canAdd = true }: Options = {}) {
  mockBabies.mockReturnValue({
    babies: baby ? [baby] : [],
    loading: false,
    current: baby ?? undefined,
    select: jest.fn(),
  });
  mockActivities.mockReturnValue({ activities, loading: false });
  mockActions.mockReturnValue({
    context: { roomId: 'room1', babyId: 'baby1', actor: { uid: 'ana', name: 'Ana' } },
    canAdd,
    canEdit: () => true,
  });
}

beforeAll(() => freezeClock(NOW));
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, revision: 0 });
});

describe('Home dashboard', () => {
  it('shows the baby, their age and the quick-log buttons', () => {
    setup();
    render(<HomeScreen />);
    expect(screen.getByText('Sofia')).toBeOnTheScreen();
    expect(screen.getByText('12 days old')).toBeOnTheScreen();
    expect(screen.getByLabelText('Log feeding')).toBeOnTheScreen();
    expect(screen.getByLabelText('Log diaper')).toBeOnTheScreen();
  });

  it('opens the right logging screen from a quick-log button', () => {
    setup();
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText('Log sleep'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/activity/start', params: { type: 'sleep' } });
  });

  it('shows when the baby was last fed and changed', () => {
    setup({
      activities: [
        makeActivity({ type: 'diaper', startedAt: NOW.getTime() - 75 * MIN, details: { diaperType: 'pee' } }),
        makeActivity({
          type: 'feeding',
          startedAt: NOW.getTime() - 42 * MIN,
          durationSeconds: 600,
          endedAt: NOW.getTime() - 32 * MIN,
          details: { feedingType: 'breast' },
        }),
      ],
    });
    render(<HomeScreen />);
    expect(screen.getByText('Last feed: 42 min ago')).toBeOnTheScreen();
    expect(screen.getByText('Last diaper: 1h 15m ago')).toBeOnTheScreen();
  });

  it('shows today totals and leaves out cards that are hidden by default', () => {
    setup({
      activities: [
        makeActivity({
          type: 'feeding',
          startedAt: NOW.getTime() - 180 * MIN,
          durationSeconds: 900,
          endedAt: NOW.getTime() - 165 * MIN,
          details: { feedingType: 'breast' },
        }),
        makeActivity({
          type: 'feeding',
          startedAt: NOW.getTime() - 60 * MIN,
          durationSeconds: 1200,
          endedAt: NOW.getTime() - 40 * MIN,
          details: { feedingType: 'breast' },
        }),
        makeActivity({ type: 'diaper', startedAt: NOW.getTime() - 50 * MIN, details: { diaperType: 'pee' } }),
        makeActivity({ type: 'diaper', startedAt: NOW.getTime() - 40 * MIN, details: { diaperType: 'poop' } }),
      ],
    });
    render(<HomeScreen />);
    expect(screen.getByLabelText('Feeding today: 2 sessions · 35m')).toBeOnTheScreen();
    expect(screen.getByLabelText('Diaper today: 2 total · 1 pee · 1 poop')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Note today/)).toBeNull();
  });

  it('respects the user choice of which cards to show', () => {
    useSettingsStore.getState().update({
      dashboardCardVisible: { ...DEFAULT_SETTINGS.dashboardCardVisible, bath: false, note: true },
    });
    setup({ activities: [makeActivity({ type: 'note', details: { title: 'x' }, startedAt: NOW.getTime() - MIN })] });
    render(<HomeScreen />);
    expect(screen.queryByLabelText(/^Bath today/)).toBeNull();
    expect(screen.getByLabelText('Note today: 1 note')).toBeOnTheScreen();
  });

  it('shows a running timer with a button to finish it', () => {
    setup({ activities: [makeActivity({ type: 'sleep', startedAt: NOW.getTime() - 84 * MIN, createdByName: 'Mom' })] });
    render(<HomeScreen />);
    expect(screen.getByText('Sleeping')).toBeOnTheScreen();
    expect(screen.getByText('01:24:00')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wake up' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Sleep, in progress')).toBeOnTheScreen();
  });

  it('invites the first log when nothing has been recorded', () => {
    setup();
    render(<HomeScreen />);
    expect(screen.getByText('No activities yet')).toBeOnTheScreen();
    expect(screen.getByText(/Start tracking Sofia’s day/)).toBeOnTheScreen();
  });

  it('explains view-only access instead of offering buttons', () => {
    setup({ canAdd: false });
    render(<HomeScreen />);
    expect(screen.getByText(/can view Sofia’s day but not log activities/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Log feeding')).toBeNull();
  });

  it('guides someone with no baby to add or join one', () => {
    setup({ baby: null });
    render(<HomeScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Join a family room' }));
    expect(router.push).toHaveBeenCalledWith('/join');
    fireEvent.press(screen.getByRole('button', { name: 'Add your baby' }));
    expect(router.push).toHaveBeenCalledWith('/baby/new');
  });
});
