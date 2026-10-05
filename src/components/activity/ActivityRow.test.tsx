import { fireEvent, render, screen } from '@testing-library/react-native';

import { freezeClock, makeActivity } from '../../../jest.fixtures';

import { ActivityRow } from './ActivityRow';

const NOW = new Date(2026, 9, 4, 15, 0);
const ZONE = 'UTC';

beforeAll(() => freezeClock(NOW));
afterAll(() => jest.useRealTimers());

describe('ActivityRow', () => {
  it('shows icon, type, time, duration, details and who logged it', () => {
    const feeding = makeActivity({
      type: 'feeding',
      startedAt: Date.UTC(2026, 9, 4, 14, 30),
      endedAt: Date.UTC(2026, 9, 4, 14, 48),
      durationSeconds: 1080,
      details: { feedingType: 'breast', side: 'left' },
      createdByName: 'Mom',
    });
    render(<ActivityRow activity={feeding} zone={ZONE} now={NOW.getTime()} onPress={jest.fn()} />);

    expect(screen.getByTestId('symbol:restaurant', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Feeding')).toBeOnTheScreen();
    expect(screen.getByText(/2:30 PM · 18m · Breastfeeding · left/)).toBeOnTheScreen();
    expect(screen.getByText('Mom')).toBeOnTheScreen();
  });

  it('describes the whole entry to screen readers, including the photo and sync state', () => {
    const diaper = makeActivity({
      type: 'diaper',
      details: { diaperType: 'both' },
      photoPath: 'rooms/r/babies/b/activities/a/photo.jpg',
      pending: true,
      createdByName: 'Dad',
    });
    render(<ActivityRow activity={diaper} zone={ZONE} now={NOW.getTime()} onPress={jest.fn()} />);
    const label = screen.getByRole('button').props.accessibilityLabel as string;
    expect(label).toContain('Diaper · Pee + Poop');
    expect(label).toContain('logged by Dad');
    expect(label).toContain('has a photo');
    expect(label).toContain('waiting to sync');
    expect(screen.getByTestId('symbol:photo_camera', { includeHiddenElements: true })).toBeTruthy();
  });

  it('says a running timer is in progress and opens details when pressed', () => {
    const onPress = jest.fn();
    const sleep = makeActivity({ type: 'sleep', startedAt: NOW.getTime() - 30 * 60_000 });
    render(<ActivityRow activity={sleep} zone={ZONE} now={NOW.getTime()} onPress={onPress} />);
    expect(screen.getByText(/In progress/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
