import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import Container from '../Container/Container';
import logo from '../../assets/brand/logo.png';
import heart from '../../assets/icons/heart.svg';
import search from '../../assets/icons/search.svg';
import { contentRepository } from '../../services/contentRepository';
import styles from './Header.module.css';

export default function Header() {
  const [panel, setPanel] = useState(null);
  const [query, setQuery] = useState('');
  const [navigation, setNavigation] = useState([]);
  const [results, setResults] = useState([]);
  const [scrollState, setScrollState] = useState({ fixed: false, hidden: false });
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const panelRef = useRef(null);
  const lastScroll = useRef(0);
  useEffect(() => {
    let active = true;
    contentRepository.navigation().then(items => { if (active) { setNavigation(items); setResults(items); } }).catch(() => { if (active) { setNavigation([]); setResults([]); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (panel === 'search') inputRef.current?.focus();
    const close = (event) => {
      if (event.key === 'Escape') { setPanel(null); menuRef.current?.focus(); return; }
      if (!panel || event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [menuRef.current, ...panelRef.current.querySelectorAll('a, input, button')].filter(Boolean);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [panel]);
  useEffect(() => {
    let active = true;
    if (panel !== 'search') return undefined;
    contentRepository.search(query)
      .then(items => { if (active) setResults(items.slice(0, 9)); })
      .catch(() => { if (active) setResults([]); });
    return () => { active = false; };
  }, [panel, query]);
  useEffect(() => {
    if (!panel) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [panel]);
  useEffect(() => {
    let frame;
    const update = () => {
      frame = undefined;
      const current = Math.max(window.scrollY, 0);
      const previous = lastScroll.current;
      const movingUp = current < previous;
      const pastHeader = current > window.innerHeight;
      if (!panel) setScrollState({ fixed: pastHeader && movingUp, hidden: pastHeader && !movingUp });
      lastScroll.current = current;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [panel]);
  useEffect(() => {
    if (panel !== null) return;
    const current = Math.max(window.scrollY, 0);
    const pastHeader = current > window.innerHeight;
    if (pastHeader) setScrollState({ fixed: false, hidden: true });
  }, [panel]);

  const panelOpen = panel !== null;
  return <header className={styles.header}>
    <a className={styles.skipLink} href="#main">Перейти к содержимому</a>
    <div className={classNames(styles.surface, { [styles.fixed]: scrollState.fixed || panelOpen, [styles.hidden]: scrollState.hidden && !panelOpen, [styles.withBorder]: scrollState.fixed })}>
    <Container className={styles.container}>
      <div className={styles.brand}>
        <Link className={styles.logo} to="/" aria-label="Help The Children SKD, главная" onClick={() => setPanel(null)}>
          <img className={styles.logoImage} src={logo} alt="" />
          <span className={styles.organizationName}>Help The Children</span>
        </Link>
        <span className={styles.caption}>помощь детям<br />и семьям</span>
      </div>
      <div className={styles.actions}>
        <div className={styles.primaryActions}>
          <button ref={menuRef} className={classNames(styles.menuButton, { [styles.active]: panel === 'menu' })} aria-expanded={panel === 'menu'} aria-controls="header-panel" aria-label={panel === 'menu' ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setPanel(panel === 'menu' ? null : 'menu')}>
            <span className={styles.burger}><span /><span /><span /></span><span className={styles.menuLabel}>Меню</span>
          </button>
          <Link className={styles.helpLink} to="/give-help" onClick={() => setPanel(null)}><img src={heart} alt="" />Помочь</Link>
        </div>
        <div className={styles.secondaryActions}>
          <button className={styles.searchButton} aria-label="Поиск по разделам" aria-expanded={panel === 'search'} aria-controls="header-panel" onClick={() => setPanel(panel === 'search' ? null : 'search')}><img src={search} alt="" /></button>
        </div>
      </div>
    </Container>
    <div ref={panelRef} id="header-panel" className={classNames(styles.panel, { [styles.panelOpen]: panelOpen })} aria-hidden={!panelOpen} inert={!panelOpen || undefined}>
      <Container>
        {panel === 'search' && <input ref={inputRef} className={styles.searchInput} type="search" placeholder="Найти раздел или материал" aria-label="Найти раздел или материал" value={query} onChange={e => setQuery(e.target.value)} />}
        <nav aria-label={panel === 'search' ? 'Результаты поиска' : 'Основная навигация'} className={styles.navigation}>
          {(panel === 'search' ? results : navigation).map((link, index) => <Link key={`${link.to}-${index}`} to={link.to} onClick={() => setPanel(null)}>{link.title}</Link>)}
        </nav>
        {panel === 'search' && results.length === 0 && <p role="status">Ничего не найдено. Попробуйте изменить запрос.</p>}
      </Container>
    </div>
    </div>
    <button className={classNames(styles.backdrop, { [styles.backdropVisible]: panelOpen })} tabIndex={panelOpen ? 0 : -1} aria-label="Закрыть открытую панель" onClick={() => setPanel(null)} />
  </header>;
}
