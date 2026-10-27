import { useCallback, useEffect, useState } from 'react';

// All consumers share one observer; completed, one-shot reveals are unobserved.
const subscribers = new Map();
let observer;

function observe(node, notify) {
  if (typeof window.IntersectionObserver !== 'function') {
    notify(true);
    return () => {};
  }
  if (!observer) {
    try {
      observer = new window.IntersectionObserver(entries => {
        entries.forEach(entry => subscribers.get(entry.target)?.(entry.isIntersecting));
      }, { threshold: 0 });
    } catch {
      notify(true);
      return () => {};
    }
  }
  subscribers.set(node, notify);
  observer.observe(node);
  return () => {
    subscribers.delete(node);
    observer?.unobserve(node);
    if (!subscribers.size) {
      observer?.disconnect();
      observer = undefined;
    }
  };
}

export default function useInView({ once = true } = {}) {
  const [node, setNode] = useState(null);
  const [isInView, setInView] = useState(false);
  const ref = useCallback(current => {
    ref.current = current;
    setNode(current);
  }, []);
  useEffect(() => {
    if (!node) return undefined;
    let stop = () => {};
    stop = observe(node, visible => {
      setInView(visible);
      if (visible && once) stop();
    });
    return stop;
  }, [node, once]);
  return { ref, isInView };
}
