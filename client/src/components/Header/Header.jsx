import { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import Container from '../Container/Container';
import logo from '../../assets/brand/logo.png';
import heart from '../../assets/icons/heart.svg';
import { contentRepository } from '../../services/contentRepository';
import styles from './Header.module.css';

export default function Header() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [navigation, setNavigation] = useState([]);
  const [search, setSearch] = useState({ query: '', items: [], status: 'idle' });
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const panelRef = useRef(null);
  const normalizedQuery = query.trim();
  const searching = normalizedQuery.length > 0;
  const searchPending = searching && (search.query !== normalizedQuery || search.status === 'loading');
  const searchFailed = searching && search.query === normalizedQuery && search.status === 'error';
  const links = searching ? (search.query === normalizedQuery ? search.items : []) : navigation;
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    let active = true;
    contentRepository.navigation()
      .then(items => { if (active) setNavigation(items); })
      .catch(() => { if (active) setNavigation([]); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (panelOpen && window.matchMedia?.('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches) {
      inputRef.current?.focus();
    }
    const onKeyDown = event => {
      if (panelOpen && event.key === 'Escape') {
        closePanel();
        menuRef.current?.focus();
        return;
      }
      if (!panelOpen || event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [menuRef.current, ...panelRef.current.querySelectorAll('a, input, button')].filter(Boolean);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closePanel, panelOpen]);
  useEffect(() => {
    if (!panelOpen || !normalizedQuery) return undefined;
    let active = true;
    setSearch({ query: normalizedQuery, items: [], status: 'loading' });
    contentRepository.search(normalizedQuery)
      .then(items => { if (active) setSearch({ query: normalizedQuery, items: items.slice(0, 9), status: 'success' }); })
      .catch(() => { if (active) setSearch({ query: normalizedQuery, items: [], status: 'error' }); });
    return () => { active = false; };
  }, [normalizedQuery, panelOpen]);
  useEffect(() => {
    if (!panelOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [panelOpen]);

  return <header className={styles.header}>
    <a className={styles.skipLink} href="#main">Перейти к содержимому</a>
    <div className={styles.surface}>
      <Container className={styles.container}>
        <div className={styles.brand}>
          <Link className={styles.logo} to="/" aria-label="Help The Children SKD, главная" onClick={closePanel}>
            <img className={styles.logoImage} src={logo} alt="" />
            <span className={styles.organizationName}>
              <span>Помощь детям</span>
              <strong>Help The Children</strong>
              <span>Балдарга жардам</span>
            </span>
          </Link>
          <span className={styles.caption}>помощь детям<br />и семьям</span>
        </div>
        <div className={styles.actions}>
          <div className={styles.primaryActions}>
            <button ref={menuRef} className={classNames(styles.menuButton, { [styles.active]: panelOpen })} aria-expanded={panelOpen} aria-controls="header-panel" aria-label={panelOpen ? 'Закрыть меню' : 'Открыть меню'} onClick={() => panelOpen ? closePanel() : setPanelOpen(true)}>
              <span className={styles.burger}><span /><span /><span /></span><span className={styles.menuLabel}>Меню</span>
            </button>
            <Link className={styles.helpLink} to="/give-help" onClick={closePanel}><img src={heart} alt="" />Помочь</Link>
          </div>
        </div>
      </Container>
      <div ref={panelRef} id="header-panel" className={classNames(styles.panel, { [styles.panelOpen]: panelOpen })} aria-hidden={!panelOpen} inert={!panelOpen || undefined}>
        <Container>
          <input ref={inputRef} className={styles.searchInput} type="search" placeholder="Найти раздел или материал" aria-label="Найти раздел или материал" aria-controls="header-navigation" value={query} onChange={event => setQuery(event.target.value)} />
          <nav id="header-navigation" aria-label={searching ? 'Результаты поиска' : 'Основная навигация'} aria-busy={searchPending || undefined} className={styles.navigation}>
            {links.map((link, index) => <Link key={`${link.to}-${index}`} to={link.to} onClick={closePanel}>{link.title}</Link>)}
          </nav>
          {searchPending && <p role="status">Ищем материалы…</p>}
          {searchFailed && <p role="status">Не удалось выполнить поиск. Попробуйте изменить запрос.</p>}
          {searching && !searchPending && !searchFailed && links.length === 0 && <p role="status">Ничего не найдено. Попробуйте изменить запрос.</p>}
        </Container>
      </div>
    </div>
    <button className={classNames(styles.backdrop, { [styles.backdropVisible]: panelOpen })} tabIndex={-1} aria-label="Закрыть открытую панель" onClick={() => { closePanel(); menuRef.current?.focus(); }} />
  </header>;
}
