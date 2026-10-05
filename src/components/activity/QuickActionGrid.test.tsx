import { fireEvent, render, screen } from '@testing-library/react-native';

import { DEFAULT_SETTINGS } from '@/lib/settings';
import { useSettingsStore } from '@/stores/settingsStore';

import { QuickActionGrid } from './QuickActionGrid';

beforeEach(() => {
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, revision: 0 });
});

describe('QuickActionGrid', () => {
  it('shows a large button for every tracked activity', () => {
    render(<QuickActionGrid onSelect={jest.fn()} />);
    for (const name of ['feeding', 'diaper', 'sleep', 'bath', 'outdoor / sunlight', 'note']) {
      expect(screen.getByLabelText(`Log ${name}`)).toBeOnTheScreen();
    }
  });

  it('starts logging with one tap', () => {
    const onSelect = jest.fn();
    render(<QuickActionGrid onSelect={onSelect} />);
    fireEvent.press(screen.getByLabelText('Log diaper'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('diaper');
  });

  it('follows the user’s order and hides activities they turned off', () => {
    useSettingsStore.getState().update({
        quickActionOrder: ['sleep', 'feeding', 'diaper', 'bath', 'outdoor', 'note'],
        enabledActivities: { ...DEFAULT_SETTINGS.enabledActivities, outdoor: false, note: false },
      });
    render(<QuickActionGrid onSelect={jest.fn()} />);
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    expect(labels).toEqual(['Log sleep', 'Log feeding', 'Log diaper', 'Log bath']);
    expect(screen.queryByLabelText('Log outdoor / sunlight')).toBeNull();
  });

  it('marks running timers with text, not just colour', () => {
    render(<QuickActionGrid onSelect={jest.fn()} running={['sleep']} />);
    expect(screen.getByLabelText('Sleep, in progress')).toBeOnTheScreen();
    expect(screen.getByText('In progress')).toBeOnTheScreen();
  });
});
