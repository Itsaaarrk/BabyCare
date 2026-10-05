import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { LegalLinks } from './LegalLinks';

describe('LegalLinks', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('shows nothing until an address is set', () => {
    render(<LegalLinks privacy="" terms="" />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows only the links that have an address', () => {
    render(<LegalLinks privacy="https://example.com/privacy" terms="" />);
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Terms of use' })).toBeNull();
  });

  it('opens each address when tapped', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<LegalLinks privacy="https://example.com/privacy" terms="https://example.com/terms" />);
    fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' }));
    fireEvent.press(screen.getByRole('link', { name: 'Terms of use' }));
    expect(open).toHaveBeenNthCalledWith(1, 'https://example.com/privacy');
    expect(open).toHaveBeenNthCalledWith(2, 'https://example.com/terms');
  });
});
