import { fireEvent, render, screen } from '@testing-library/react-native';

import { freezeClock, makeActivity } from '../../../jest.fixtures';

import { ActiveTimerCard } from './ActiveTimerCard';

const NOW = new Date(2026, 9, 4, 15, 0);

beforeAll(() => freezeClock(NOW));
afterAll(() => jest.useRealTimers());

describe('ActiveTimerCard', () => {
  const sleep = makeActivity({ type: 'sleep', startedAt: NOW.getTime() - 84 * 60_000, createdByName: 'Mom' });

  it('shows the running clock, what is happening and who started it', () => {
    render(<ActiveTimerCard activity={sleep} canFinish onFinish={jest.fn()} />);
    expect(screen.getByText('Sleeping')).toBeOnTheScreen();
    expect(screen.getByText('01:24:00')).toBeOnTheScreen();
    expect(screen.getByText('Started by Mom')).toBeOnTheScreen();
  });

  it('finishes the timer without also opening its details', () => {
    const onFinish = jest.fn();
    const onPress = jest.fn();
    render(<ActiveTimerCard activity={sleep} canFinish onFinish={onFinish} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Wake up' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('opens the details from the header', () => {
    const onPress = jest.fn();
    render(<ActiveTimerCard activity={sleep} canFinish onFinish={jest.fn()} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Sleeping for 1 hour 24 minutes'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hides the finish button from people who can’t end timers', () => {
    render(<ActiveTimerCard activity={sleep} canFinish={false} onFinish={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Wake up' })).toBeNull();
  });

  it('uses the right wording for each kind of timer', () => {
    const feeding = makeActivity({ type: 'feeding', startedAt: NOW.getTime() - 60_000, details: { feedingType: 'breast', side: 'left' } });
    render(<ActiveTimerCard activity={feeding} canFinish onFinish={jest.fn()} />);
    expect(screen.getByText('Feeding')).toBeOnTheScreen();
    expect(screen.getByText(/Breastfeeding · left/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Finish feeding' })).toBeOnTheScreen();
  });
});
