import { useEffect, useState } from 'react';
import classNames from 'classnames';
import useInView from '../../hooks/useInView';
import styles from './RevealImage.module.css';

export default function RevealImage({ className, onLoad, onError, alt = '', src, fallbackLabel = 'Изображение недоступно', ...props }) {
  const { ref, isInView } = useInView();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!src);
  useEffect(() => {
    if (!src) {
      setFailed(true);
      setLoaded(false);
      return;
    }
    setFailed(false);
    if (ref.current?.complete) {
      setLoaded(ref.current.naturalWidth > 0);
      setFailed(ref.current.naturalWidth === 0);
    } else {
      setLoaded(false);
    }
  }, [src, ref]);
  if (failed || !src) {
    const decorative = alt === '' || props['aria-hidden'] === true || props['aria-hidden'] === 'true';
    return <span className={classNames(styles.image, styles.fallback, styles.visible, className)} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : fallbackLabel} aria-hidden={decorative || undefined} />;
  }
  return <img {...props} src={src} alt={alt} ref={ref} loading="lazy"
    className={classNames(styles.image, className, { [styles.visible]: isInView && loaded })}
    onLoad={event => { setLoaded(true); onLoad?.(event); }}
    onError={event => { setFailed(true); onError?.(event); }} />;
}
