import { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import useInView from '../../hooks/useInView';
import useReducedMotion from '../../hooks/useReducedMotion';
import Container from '../Container/Container';
import SectionHeading from '../SectionHeading/SectionHeading';
import TextLink from '../TextLink/TextLink';
import RevealImage from '../RevealImage/RevealImage';
import ContentState from '../ContentState/ContentState';
import { useCollection } from '../../hooks/useContent';
import { Link } from 'react-router-dom';
import { ReactComponent as Arrow } from '../../assets/icons/next.svg';
import styles from './ChildrenSection.module.css';

export default function ChildrenSection({ heading, description, itemLimit }) {
  const limit = Math.max(4, Number(itemLimit) || 6);
  const { data: children, loading, error } = useCollection('children', { pageSize: limit });
  const { ref, isInView } = useInView();
  const reducedMotion = useReducedMotion();
  const viewportRef = useRef(null);
  const [scrollState, setScrollState] = useState({ previous: false, next: false });
  const [introReady, setIntroReady] = useState(false);
  const visibleChildren = children.slice(0, limit);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const end = viewport.scrollWidth - viewport.clientWidth;
    setScrollState({ previous: viewport.scrollLeft > 2, next: end - viewport.scrollLeft > 2 });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIntroReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [updateScrollState, visibleChildren.length]);

  const scroll = direction => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: direction * viewport.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  if (loading || error || children.length === 0) return <section id="children" className={styles.section}><ContentState loading={loading} error={error} empty={!loading && !error && children.length === 0} emptyMessage="Карточки помощи пока не опубликованы." /></section>;
  return <section id="children" className={styles.section} aria-labelledby="children-title">
    <div ref={ref}><Container className={classNames(styles.reveal, { [styles.visible]: reducedMotion || (isInView && introReady) })}>
      <div className={styles.heading}>
        <SectionHeading id="children-title" title={heading || 'Дети'}>{description || 'Актуальные карточки помощи и истории детей.'}</SectionHeading>
        <div className={styles.controls}>
          <button className={styles.previous} type="button" disabled={!scrollState.previous} onClick={() => scroll(-1)} aria-label="Предыдущие карточки детей"><Arrow aria-hidden="true" /></button>
          <button type="button" disabled={!scrollState.next} onClick={() => scroll(1)} aria-label="Следующие карточки детей"><Arrow aria-hidden="true" /></button>
        </div>
      </div>
      <div ref={viewportRef} className={styles.viewport} role="region" aria-label="Карточки детей" onScroll={updateScrollState}>
        <div className={styles.track}>
          {visibleChildren.map(child => <article className={styles.card} key={child.id}>
            <Link className={styles.childLink} to={`/children/${child.slug}`}>
              <RevealImage className={styles.photo} src={child.image} alt={child.imageAlt || `Обложка: ${child.name}`} fallbackLabel={`Обложка для «${child.name}» недоступна`} />
              <div className={styles.cardContent}>
                <h3 className={styles.name}>{child.name}</h3>
                {child.disease && <p className={styles.disease}>{child.disease}</p>}
                <span className={styles.help}>Помочь →</span>
              </div>
            </Link>
          </article>)}
        </div>
      </div>
      <TextLink className={styles.more} to="/children">Все карточки</TextLink>
    </Container></div>
  </section>;
}
