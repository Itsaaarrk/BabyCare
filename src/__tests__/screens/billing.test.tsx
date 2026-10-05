import { router } from 'expo-router';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import ManageBabiesScreen from '@/app/baby';
import BillingScreen from '@/app/preferences/billing';
import PaywallScreen from '@/app/paywall';
import { BabyEditor } from '@/components/baby/BabyEditor';
import { PLAY_SUBSCRIPTIONS_URL } from '@/lib/billing/config';
import type { RoomEntitlement } from '@/lib/billing/entitlement';
import { useAuthStore } from '@/stores/authStore';
import { useBabyStore, type RoomState } from '@/stores/babyStore';
import type { RoomRole } from '@/types/baby';

import { freezeClock } from '../../../jest.fixtures';

jest.mock('@/components/baby/BabyAvatar', () => ({ BabyAvatar: () => null }));
// The store is seeded directly, so nothing needs to listen to Firebase.
jest.mock('@/services/babies/babySync', () => ({ subscribeToUserRooms: jest.fn() }));
jest.mock('@/services/storage/photoService', () => ({
  compressImage: jest.fn(),
  uploadBabyPhoto: jest.fn(),
  PhotoTooLargeError: class PhotoTooLargeError extends Error {},
}));
jest.mock('@/services/babies/babyService', () => ({
  addBaby: jest.fn(),
  createBabyWithRoom: jest.fn(),
  deleteBaby: jest.fn(),
  setBabyPhotoPath: jest.fn(),
  updateBaby: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

const NOW = new Date(2026, 9, 5, 12, 0);
const DAY = 86_400_000;
const record = (name: string) => ({ name, birthDate: '2026-09-22', createdBy: 'ana', createdAt: 1, updatedAt: 1 });

function seed({
  role = 'owner',
  entitlement = null,
  babies = 1,
}: { role?: RoomRole; entitlement?: RoomEntitlement | null; babies?: number } = {}) {
  const room: RoomState = {
    info: { name: "Sofia's Family", ownerId: 'ana', ownerName: 'Ana', createdAt: 1 },
    role,
    members: [],
    babies: Object.fromEntries(Array.from({ length: babies }, (_, i) => [`baby${i + 1}`, record(`Baby ${i + 1}`)])),
    entitlement,
  };
  useBabyStore.setState({ rooms: { room1: room }, roomIndexLoaded: true, selected: null, cacheUid: 'ana' });
}

const plus = (over: Partial<RoomEntitlement> = {}): RoomEntitlement => ({
  plan: 'plus_yearly',
  status: 'active',
  expiresAt: NOW.getTime() + 200 * DAY,
  updatedAt: 1,
  ...over,
});

beforeAll(() => freezeClock(NOW));
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: { uid: 'ana', email: 'ana@example.com', displayName: 'Ana' } });
});

describe('Paywall', () => {
  beforeEach(() => seed());

  it('lists only features that exist today', () => {
    render(<PaywallScreen />);
    expect(screen.getByText('Up to 5 babies in your family room')).toBeOnTheScreen();
    for (const unfinished of ['PDF reports', 'Data export', 'No ads', 'More photo storage']) {
      expect(screen.queryByText(unfinished)).toBeNull();
    }
  });

  it('says plainly what recurs and what does not', () => {
    render(<PaywallScreen />);
    expect(screen.getByText(/Recurring subscription. Renews every month/)).toBeOnTheScreen();
    expect(screen.getByText(/Recurring subscription. Renews every year/)).toBeOnTheScreen();
    expect(screen.getByText(/One-time purchase. Not a subscription/)).toBeOnTheScreen();
  });

  it('works out the yearly saving from the prices instead of hard-coding it', () => {
    render(<PaywallScreen />);
    expect(screen.getByText(/Save .*549.* \(35\.5%\) compared with twelve monthly payments/)).toBeOnTheScreen();
    expect(screen.getByText(/83\.25 a month/)).toBeOnTheScreen();
    expect(screen.getByText('Best value')).toBeOnTheScreen();
  });

  it('preselects nothing and cannot be continued, because purchases are not open yet', () => {
    render(<PaywallScreen />);
    for (const name of [/^Monthly/, /^Yearly/, /^Lifetime/]) {
      expect(screen.getByRole('radio', { name }).props.accessibilityState.selected).toBe(false);
    }
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/Nothing can be bought yet and nothing is charged/)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('radio', { name: /^Yearly/ }));
    expect(screen.getByRole('radio', { name: /^Yearly/ }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('radio', { name: /^Monthly/ }).props.accessibilityState.selected).toBe(false);
    // Choosing a plan doesn't make a purchase possible.
    expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled).toBe(true);
  });

  it('offers restore (not yet available) and a way to manage subscriptions in Google Play', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<PaywallScreen />);
    expect(screen.getByRole('button', { name: 'Restore purchases' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Manage subscriptions in Google Play' }));
    expect(open).toHaveBeenCalledWith(PLAY_SUBSCRIPTIONS_URL);
  });
});

describe('Subscription & billing', () => {
  it('shows the Free plan with an upgrade for the owner', () => {
    seed();
    render(<BillingScreen />);
    expect(screen.getByText('BabyCare Free')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Upgrade to BabyCare Plus' }));
    expect(router.push).toHaveBeenCalledWith('/paywall');
  });

  it('does not offer the upgrade to members who are not the owner', () => {
    seed({ role: 'parent' });
    render(<BillingScreen />);
    expect(screen.queryByRole('button', { name: /Upgrade/ })).toBeNull();
    expect(screen.getByText(/owner can upgrade/)).toBeOnTheScreen();
  });

  it('shows an active yearly plan with its renewal date to the owner', () => {
    seed({ entitlement: plus() });
    render(<BillingScreen />);
    expect(screen.getByText('Yearly')).toBeOnTheScreen();
    expect(screen.getByText('Active')).toBeOnTheScreen();
    expect(screen.getByText('Next renewal')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Manage subscription' })).toBeOnTheScreen();
  });

  it('keeps Plus on after cancelling until the date, and says no more charges', () => {
    seed({ entitlement: plus({ status: 'cancelled' }) });
    render(<BillingScreen />);
    expect(screen.getByText('Cancelled')).toBeOnTheScreen();
    expect(screen.getByText(/Active until .* You will not be charged again/)).toBeOnTheScreen();
  });

  it('shows lifetime as a one-time purchase with no subscription to manage', () => {
    seed({ entitlement: { plan: 'lifetime', status: 'active', expiresAt: null, updatedAt: 1 } });
    render(<BillingScreen />);
    expect(screen.getByText('Lifetime')).toBeOnTheScreen();
    expect(screen.getByText('One-time purchase. No renewal.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Manage subscription' })).toBeNull();
  });

  it('shows other members only that the room has Plus, without plan or payment details', () => {
    seed({ role: 'caregiver', entitlement: plus() });
    render(<BillingScreen />);
    expect(screen.getByText('This family room has BabyCare Plus.')).toBeOnTheScreen();
    expect(screen.queryByText('Yearly')).toBeNull();
    expect(screen.queryByText('Next renewal')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('treats a lapsed plan as Free even if the stored status still says active', () => {
    seed({ entitlement: plus({ expiresAt: NOW.getTime() - 1000 }) });
    render(<BillingScreen />);
    expect(screen.getByText('BabyCare Free')).toBeOnTheScreen();
    expect(screen.queryByText('Yearly')).toBeNull();
  });
});

describe('the baby limit', () => {
  it('lets a Free room with no babies add one', () => {
    seed({ babies: 0 });
    render(<ManageBabiesScreen />);
    expect(screen.getByRole('button', { name: 'Add a baby' })).toBeOnTheScreen();
  });

  it('explains the limit instead of offering "Add a baby" once a Free room has one baby', () => {
    seed({ babies: 1 });
    render(<ManageBabiesScreen />);
    expect(screen.queryByRole('button', { name: 'Add a baby' })).toBeNull();
    expect(screen.getByText('More babies')).toBeOnTheScreen();
    expect(screen.getByText(/Your plan includes 1 baby\. BabyCare Plus lets a family room track up to 5/)).toBeOnTheScreen();
    // The existing baby is still listed; nothing is hidden or removed.
    expect(screen.getByText('Baby 1')).toBeOnTheScreen();
  });

  it('offers it again on Plus, up to five', () => {
    seed({ babies: 3, entitlement: plus() });
    const { unmount } = render(<ManageBabiesScreen />);
    expect(screen.getByRole('button', { name: 'Add a baby' })).toBeOnTheScreen();
    unmount();

    seed({ babies: 5, entitlement: plus() });
    render(<ManageBabiesScreen />);
    expect(screen.queryByRole('button', { name: 'Add a baby' })).toBeNull();
  });

  it('keeps every baby after Plus lapses and only stops adding', () => {
    seed({ babies: 2, entitlement: plus({ expiresAt: NOW.getTime() - DAY }) });
    render(<ManageBabiesScreen />);
    expect(screen.getByText('Baby 1')).toBeOnTheScreen();
    expect(screen.getByText('Baby 2')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add a baby' })).toBeNull();
  });

  it('blocks the new-baby form too, so it can’t be reached by going straight to it', () => {
    seed({ babies: 1 });
    render(<BabyEditor />);
    expect(screen.getByText('More babies')).toBeOnTheScreen();
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('still shows the form for a first baby, and when editing an existing one', () => {
    seed({ babies: 0 });
    const { unmount } = render(<BabyEditor />);
    expect(screen.queryByText('More babies')).toBeNull();
    unmount();

    seed({ babies: 1 });
    render(
      <BabyEditor
        baby={{ id: 'baby1', roomId: 'room1', roomName: '', role: 'owner', ...record('Baby 1') }}
      />,
    );
    expect(screen.queryByText('More babies')).toBeNull();
  });
});
