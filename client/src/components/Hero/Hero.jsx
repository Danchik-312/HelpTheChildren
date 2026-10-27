import { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import useInView from '../../hooks/useInView';
import useReducedMotion from '../../hooks/useReducedMotion';
import Container from '../Container/Container';
import ContentState from '../ContentState/ContentState';
import { useCollection } from '../../hooks/useContent';
import { Link } from 'react-router-dom';
import { ReactComponent as Arrow } from '../../assets/icons/next.svg';
import styles from './Hero.module.css';

function HeroMedia({ slide, eager }) {
  const [failed, setFailed] = useState(false);
  const media = slide.media;
  if (failed || !media?.url) return <div className={styles.mediaFallback} role="img" aria-label={slide.altText || 'Изображение недоступно'} />;
  if (media.kind === 'EXTERNAL_VIDEO') {
    return <iframe className={styles.image} src={media.url} title={slide.altText || 'Видео'} loading="lazy" allow="fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" onError={() => setFailed(true)} />;
  }
  if (media.kind === 'VIDEO') {
    return <video className={styles.image} src={media.url} poster={slide.poster?.url} aria-label={slide.altText || undefined} aria-hidden={slide.isDecorative || undefined} autoPlay muted loop playsInline preload={eager ? 'metadata' : 'none'} onError={() => setFailed(true)} />;
  }
  return <img className={styles.image} src={media.url} alt={slide.altText || ''} fetchPriority={eager ? 'high' : 'auto'} onError={() => setFailed(true)} />;
}

export default function Hero() {
  const { data: slides, loading, error } = useCollection('hero');
  const [carousel, setCarousel] = useState({ active: 0, previous: null, initial: true });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const { ref, isInView } = useInView({ once: false });
  const reducedMotion = useReducedMotion();
  const locked = useRef(false);
  const touch = useRef(null);
  const { active, previous, initial } = carousel;
  const changeSlide = useCallback(direction => {
    if (locked.current || slides.length === 0) return;
    locked.current = !reducedMotion;
    setCarousel(current => ({ active: (current.active + direction + slides.length) % slides.length, previous: reducedMotion ? null : current.active, initial: false }));
  }, [reducedMotion, slides.length]);

  useEffect(() => {
    if (previous === null) { locked.current = false; return undefined; }
    const timer = setTimeout(() => {
      locked.current = false;
      setCarousel(current => ({ ...current, previous: null }));
    }, reducedMotion ? 0 : 550);
    return () => clearTimeout(timer);
  }, [active, previous, reducedMotion]);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (reducedMotion || hovered || focused || !isInView || !pageVisible) return undefined;
    const timer = setTimeout(() => changeSlide(1), 5000);
    return () => clearTimeout(timer);
  }, [active, changeSlide, focused, hovered, isInView, pageVisible, reducedMotion]);

  const finishSwipe = event => {
    if (!touch.current) return;
    const dx = touch.current.x - event.changedTouches[0].clientX;
    const dy = touch.current.y - event.changedTouches[0].clientY;
    if (Math.abs(dx) > 13 && Math.abs(dx) > Math.abs(dy)) changeSlide(dx > 0 ? 1 : -1);
    touch.current = null;
  };

  if (loading || error || slides.length === 0) return <section id="about" className={styles.hero}><ContentState loading={loading} error={error} empty={!loading && !error && slides.length === 0} emptyMessage="Главные материалы пока не опубликованы." /></section>;
  return <section ref={ref} id="about" className={styles.hero} aria-roledescription="карусель" aria-label="Об организации"
    onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={finishSwipe} onTouchCancel={() => { touch.current = null; }}>
    {[previous, active].filter(index => index !== null).map(index => {
      const slide = slides[index];
      const outgoing = index !== active;
      const Heading = outgoing ? 'p' : 'h1';
      return <Container key={index} inert={outgoing || undefined} aria-hidden={outgoing || undefined}
        className={classNames(styles.container, { [styles.outgoing]: outgoing, [styles.entering]: !outgoing && !initial, [styles.initial]: initial, [styles.fromLeft]: index === 0, [styles.typeChanged]: previous === 0 || index === 0 })}>
        <div className={styles.content}>
          {slide.title ? <><Heading className={styles.title}>{slide.title}</Heading><p className={styles.description}>{slide.description}</p>{slide.to ? <Link className={styles.more} to={slide.to}>{slide.ctaLabel || 'Подробнее →'}</Link> : <a className={styles.more} href="#help">Узнать больше →</a>}</> : <Heading className={styles.statement}>{slide.description}</Heading>}
        </div>
        <div className={styles.imageWrapper}><HeroMedia slide={slide} eager={initial && index === active} /></div>
      </Container>;
    })}
    <Container className={styles.controlsContainer}>
      <div className={styles.controls}>
        <button className={styles.previous} onClick={() => changeSlide(-1)} aria-label="Предыдущий слайд"><Arrow aria-hidden="true" /></button>
        <button onClick={() => changeSlide(1)} aria-label="Следующий слайд"><Arrow aria-hidden="true" /></button>
      </div>
      <span className={styles.status} aria-live={focused || reducedMotion ? 'polite' : 'off'} aria-atomic="true">Слайд {active + 1} из {slides.length}</span>
    </Container>
  </section>;
}
