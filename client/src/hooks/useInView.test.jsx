import { vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import useInView from './useInView';

const originalIntersectionObserver = window.IntersectionObserver;

function Probe() {
  const { ref, isInView } = useInView();
  return <div ref={ref} data-testid="probe" data-visible={String(isInView)} />;
}

function DeferredProbe({ show }) {
  const { ref, isInView } = useInView();
  return show ? <div ref={ref} data-testid="probe" data-visible={String(isInView)} /> : null;
}

afterEach(() => {
  cleanup();
  if (originalIntersectionObserver === undefined) delete window.IntersectionObserver;
  else window.IntersectionObserver = originalIntersectionObserver;
});

test('shows content when IntersectionObserver is unavailable', () => {
  delete window.IntersectionObserver;
  render(<Probe />);
  expect(screen.getByTestId('probe')).toHaveAttribute('data-visible', 'true');
});

test('shows content when IntersectionObserver cannot be initialized', () => {
  window.IntersectionObserver = vi.fn(function IntersectionObserver() {
    throw new Error('IntersectionObserver initialization failed');
  });
  render(<Probe />);
  expect(screen.getByTestId('probe')).toHaveAttribute('data-visible', 'true');
});

test('observes a DOM node attached after the hook initially rendered without one', () => {
  let callback;
  const observe = vi.fn();
  window.IntersectionObserver = vi.fn(function IntersectionObserver(handler) {
    callback = handler;
    this.observe = observe;
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  });
  const { rerender } = render(<DeferredProbe show={false} />);
  expect(observe).not.toHaveBeenCalled();

  rerender(<DeferredProbe show />);
  const node = screen.getByTestId('probe');
  expect(observe).toHaveBeenCalledWith(node);
  act(() => callback([{ target: node, isIntersecting: true }]));
  expect(node).toHaveAttribute('data-visible', 'true');
});
