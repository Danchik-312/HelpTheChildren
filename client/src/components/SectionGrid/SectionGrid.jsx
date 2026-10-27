import classNames from 'classnames';
import Container from '../Container/Container';
import PencilLink from '../PencilLink/PencilLink';
import useInView from '../../hooks/useInView';
import useReducedMotion from '../../hooks/useReducedMotion';
import { Link } from 'react-router-dom';
import styles from './SectionGrid.module.css';

export default function SectionGrid({ items, tone = 'light', columns = 2, label }) {
  const { ref, isInView } = useInView();
  const reducedMotion = useReducedMotion();
  const visible = isInView || reducedMotion;

  return <section ref={ref} className={classNames(styles.section, styles[tone])} aria-label={label}>
    <Container as="ul" className={classNames(styles.grid, styles[`columns${columns}`])}>
      {items.map(item => <li key={item.id || item.slug || item.title} className={classNames(styles.item, { [styles.visible]: visible })}>
        <PencilLink as={Link} to={item.to || item.href} className={styles.link}>
          <span className={styles.title}>{item.title}</span>
          <span className={styles.description}>{item.description}</span>
        </PencilLink>
      </li>)}
    </Container>
  </section>;
}
