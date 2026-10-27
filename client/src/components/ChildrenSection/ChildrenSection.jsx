import { useEffect, useState } from 'react';
import classNames from 'classnames';
import useInView from '../../hooks/useInView';
import useReducedMotion from '../../hooks/useReducedMotion';
import Container from '../Container/Container';
import SectionHeading from '../SectionHeading/SectionHeading';
import TextLink from '../TextLink/TextLink';
import PencilLink from '../PencilLink/PencilLink';
import RevealImage from '../RevealImage/RevealImage';
import ContentState from '../ContentState/ContentState';
import { useCollection } from '../../hooks/useContent';
import { Link } from 'react-router-dom';
import styles from './ChildrenSection.module.css';

export default function ChildrenSection({ heading, description, itemLimit }) {
  const { data: children, loading, error } = useCollection('children', { pageSize: itemLimit || 6 });
  const [active, setActive] = useState(null);
  const { ref, isInView } = useInView();
  const reducedMotion = useReducedMotion();
  const [introReady, setIntroReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIntroReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);
  if (loading || error || children.length === 0) return <section id="children" className={styles.section}><ContentState loading={loading} error={error} empty={!loading && !error && children.length === 0} emptyMessage="Карточки помощи пока не опубликованы." /></section>;
  return <section id="children" className={styles.section} aria-labelledby="children-title">
    <div ref={ref}><Container className={classNames(styles.reveal, { [styles.visible]: reducedMotion || (isInView && introReady) })}>
      <SectionHeading id="children-title" title={heading || 'Дети'}>{description || 'Актуальные карточки помощи и истории детей.'}</SectionHeading>
      <div className={styles.content}>
        <div className={styles.list} onPointerLeave={() => setActive(null)}>
          {children.slice(0, itemLimit || children.length).map((child, index) => <article className={styles.card} key={child.id}>
            <Link className={styles.childLink} to={`/children/${child.slug}`} onPointerEnter={event => { if (event.pointerType === 'mouse') setActive(index); }} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
              {child.image && <RevealImage className={styles.mobilePhoto} src={child.image} alt={child.imageAlt || ''} />}
              <div className={styles.cardContent}><h3 className={styles.name}>{child.name}</h3><span className={styles.details}><span className={styles.disease}>{child.disease}</span><PencilLink as="span" className={styles.help}>Помочь →</PencilLink></span></div>
            </Link>
          </article>)}
          <TextLink className={styles.more} to="/children">Все карточки</TextLink>
        </div>
        {children.slice(0, itemLimit || children.length).map((child, index) => child.image && <img key={child.id} className={classNames(styles.preview, { [styles.previewVisible]: active === index })} src={child.image} alt="" aria-hidden="true" loading="lazy" />)}
      </div>
    </Container></div>
  </section>;
}
