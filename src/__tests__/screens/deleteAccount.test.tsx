import { router } from 'expo-router';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import DeleteAccountScreen from '@/app/preferences/delete-account';
import {
  confirmWithGoogle,
  confirmWithPassword,
  currentSignInMethod,
  deleteMyAccount,
} from '@/services/auth/accountService';
import { useBabyStore, type RoomState } from '@/stores/babyStore';
import type { RoomRole } from '@/types/baby';

jest.mock('@/services/auth/accountService', () => ({
  currentSignInMethod: jest.fn(),
  confirmWithPassword: jest.fn(),
  confirmWithGoogle: jest.fn(),
  deleteMyAccount: jest.fn(),
}));
jest.mock('@/services/babies/babySync', () => ({ subscribeToUserRooms: jest.fn() }));

const method = currentSignInMethod as jest.Mock;
const withPassword = confirmWithPassword as jest.Mock;
const withGoogle = confirmWithGoogle as jest.Mock;
const deleteAccount = deleteMyAccount as jest.Mock;

function seedRoom(role: RoomRole | null) {
  const rooms: Record<string, RoomState> = role
    ? { room1: { info: { name: "Sofia's Family", ownerId: 'ana', ownerName: 'Ana', createdAt: 1 }, role, babies: {} } }
    : {};
  useBabyStore.setState({ rooms, roomIndexLoaded: true, selected: null, cacheUid: 'ana' });
}

/** Alerts are confirmed by pressing their destructive button, as a person would. */
function confirmAlerts() {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.style === 'destructive')?.onPress?.();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  seedRoom(null);
  method.mockReturnValue('password');
  withPassword.mockResolvedValue(undefined);
  withGoogle.mockResolvedValue(true);
  deleteAccount.mockResolvedValue(undefined);
});

describe('Delete account', () => {
  it('explains what is and is not deleted', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText(/account and sign-in are permanently deleted/)).toBeOnTheScreen();
    expect(screen.getByText(/Entries you logged stay in your family’s journal/)).toBeOnTheScreen();
  });

  it('sends a room owner to delete the room first, and offers no deletion', () => {
    seedRoom('owner');
    render(<DeleteAccountScreen />);
    expect(screen.getByText('You own a family room')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Delete my account' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Go to Family' }));
    expect(router.push).toHaveBeenCalledWith('/family');
  });

  it('does not block members who are not the owner', () => {
    seedRoom('parent');
    render(<DeleteAccountScreen />);
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeOnTheScreen();
  });

  it('needs the password before it will delete anything', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByRole('button', { name: 'Delete my account' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText('Enter your password to confirm'), 'secret1');
    expect(screen.getByRole('button', { name: 'Delete my account' }).props.accessibilityState.disabled).toBe(false);
  });

  it('asks once more, then confirms the password and deletes, in that order', async () => {
    const alert = confirmAlerts();
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByLabelText('Enter your password to confirm'), 'secret1');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    });

    expect(alert).toHaveBeenCalledWith('Delete your account?', 'This can’t be undone.', expect.any(Array));
    expect(withPassword).toHaveBeenCalledWith('secret1');
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(withPassword.mock.invocationCallOrder[0]).toBeLessThan(deleteAccount.mock.invocationCallOrder[0]!);
  });

  it('deletes nothing if the person backs out of the confirmation', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.style === 'cancel')?.onPress?.());
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByLabelText('Enter your password to confirm'), 'secret1');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    });
    expect(withPassword).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes nothing and says so when the password is wrong', async () => {
    confirmAlerts();
    withPassword.mockRejectedValue(Object.assign(new Error('bad'), { name: 'FirebaseError', code: 'auth/wrong-password' }));
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByLabelText('Enter your password to confirm'), 'nope');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    });
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(await screen.findByText(/Incorrect email or password/)).toBeOnTheScreen();
  });

  it('shows what the server said when it refuses, such as a room still owned', async () => {
    confirmAlerts();
    deleteAccount.mockRejectedValue(
      Object.assign(new Error('x'), { name: 'FirebaseError', code: 'functions/failed-precondition', details: { reason: 'owns-room' } }),
    );
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByLabelText('Enter your password to confirm'), 'secret1');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    });
    expect(await screen.findByText(/You own a family room/)).toBeOnTheScreen();
  });

  it('confirms with Google for Google accounts, and does nothing if they cancel', async () => {
    method.mockReturnValue('google');
    confirmAlerts();
    withGoogle.mockResolvedValueOnce(false);
    render(<DeleteAccountScreen />);
    expect(screen.queryByLabelText('Enter your password to confirm')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    });
    expect(withGoogle).toHaveBeenCalledTimes(1);
    expect(deleteAccount).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    });
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('does not offer deletion when the sign-in method is unknown', () => {
    method.mockReturnValue('unknown');
    render(<DeleteAccountScreen />);
    expect(screen.getByRole('button', { name: 'Delete my account' }).props.accessibilityState.disabled).toBe(true);
  });
});
