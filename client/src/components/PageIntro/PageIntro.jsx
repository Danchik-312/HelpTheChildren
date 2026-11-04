import classNames from 'classnames';
import Container from '../Container/Container';
import useInView from '../../hooks/useInView';
import useReducedMotion from '../../hooks/useReducedMotion';
import styles from './PageIntro.module.css';

export default function PageIntro({ title, children, action, image, imageAlt = '', compact = false, preserveImageRatio = false }) {
  const { ref, isInView } = useInView();
  const reducedMotion = useReducedMotion();

  return <section ref={ref} className={classNames(styles.section, { [styles.withImage]: image })}>
    <Container className={classNames(styles.container, { [styles.compact]: compact, [styles.visible]: isInView || reducedMotion })}>
      <h1 className={styles.title}>{title}</h1>
      {image && <img className={classNames(styles.image, { [styles.naturalImage]: preserveImageRatio })} src={image} alt={imageAlt} />}
      {children && <p className={styles.description}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </Container>
  </section>;
}
