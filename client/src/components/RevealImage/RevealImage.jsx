import { useEffect, useState } from 'react';
import classNames from 'classnames';
import useInView from '../../hooks/useInView';
import styles from './RevealImage.module.css';

export default function RevealImage({ className, onLoad, onError, alt, ...props }) {
  const { ref, isInView } = useInView();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(Boolean(ref.current?.complete));
  }, [props.src, ref]);
  return <img {...props} alt={alt} ref={ref} loading="lazy"
    className={classNames(styles.image, className, { [styles.visible]: isInView && loaded })}
    onLoad={event => { setLoaded(true); onLoad?.(event); }}
    onError={event => { setLoaded(true); onError?.(event); }} />;
}
