import { render, screen } from '@testing-library/react';
import App from './Game';

test('renders Clubbage header', () => {
  render(<App />);
  const headerElement = screen.getByRole('heading', { name: /Clubbage!!/i });
  expect(headerElement).toBeInTheDocument();
});
