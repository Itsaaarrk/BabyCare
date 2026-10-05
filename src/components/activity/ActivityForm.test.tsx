import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_SETTINGS } from '@/lib/settings';

import { ActivityForm } from './ActivityForm';

jest.mock('@/services/storage/photoService', () => ({ compressImage: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

beforeEach(() => {
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, revision: 0 });
});

const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Save' }));

describe('ActivityForm', () => {
  it('asks for a diaper type before saving, then saves the choice', async () => {
    const onSubmit = jest.fn();
    render(<ActivityForm type="diaper" submitLabel="Save" onSubmit={onSubmit} />);

    submit();
    expect(await screen.findByText('Choose a diaper type')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('radio', { name: 'Pee + Poop' }));
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ type: 'diaper', diaperType: 'both', endedAt: null });
    expect(onSubmit.mock.calls[0][1]).toBeNull();
  });

  it('defaults a feeding to breastfeeding, shows the side only for breast, and keeps the amount', async () => {
    const onSubmit = jest.fn();
    render(<ActivityForm type="feeding" submitLabel="Save" onSubmit={onSubmit} />);

    expect(screen.getByRole('radio', { name: 'Left' })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('radio', { name: 'Bottle' }));
    expect(screen.queryByRole('radio', { name: 'Left' })).toBeNull();

    fireEvent.changeText(screen.getByLabelText('Amount (optional)'), '120');
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ feedingType: 'bottle', amount: '120', amountUnit: 'ml' });
  });

  it('rejects a bad amount with a clear message', async () => {
    const onSubmit = jest.fn();
    render(<ActivityForm type="feeding" submitLabel="Save" onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('Amount (optional)'), 'lots');
    submit();
    expect(await screen.findByText('Enter a valid amount')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lets a timed activity be left running, and shows the end time when finished', async () => {
    render(<ActivityForm type="sleep" submitLabel="Save" onSubmit={jest.fn()} />);
    expect(screen.queryByLabelText('Ended')).toBeNull();
    fireEvent.press(screen.getByRole('radio', { name: 'Finished' }));
    expect(await screen.findByLabelText('Ended')).toBeOnTheScreen();
  });

  it('requires a title for notes', async () => {
    const onSubmit = jest.fn();
    render(<ActivityForm type="note" submitLabel="Save" onSubmit={onSubmit} />);
    submit();
    expect(await screen.findByText('Add a title')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Title'), 'Sleepy this afternoon');
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ type: 'note', title: 'Sleepy this afternoon' });
  });

  it('offers a running/finished choice for baths but not for diapers', () => {
    const { unmount } = render(<ActivityForm type="bath" submitLabel="Save" onSubmit={jest.fn()} />);
    expect(screen.getByText('Status')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Night' })).toBeOnTheScreen();
    unmount();

    render(<ActivityForm type="diaper" submitLabel="Save" onSubmit={jest.fn()} />);
    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.queryByLabelText('Ended')).toBeNull();
  });
});
