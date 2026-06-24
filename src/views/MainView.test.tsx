import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MainView } from './MainView';

describe('MainView', () => {
  it('renders the placeholder navigation', () => {
    render(<MainView />);

    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Companion Home' })).toBeInTheDocument();
    expect(screen.getByText(/buddy lives on the desktop/i)).toBeInTheDocument();
    for (const label of ['Chat', 'Journal', 'Reviews', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });
});
