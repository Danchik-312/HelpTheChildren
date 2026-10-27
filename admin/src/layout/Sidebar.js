import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { navigationGroups } from './navigation';
import styles from './Sidebar.module.css';

export default function Sidebar({ open, onClose }) {
  const { user, hasArea } = useAuth();
  const location = useLocation();
  const visible = item => item.adminOnly ? user?.role === 'ADMIN' : hasArea(item.area);
  return (
    <>
      {open && <button className={styles.backdrop} type="button" aria-label="Закрыть меню" onClick={onClose} />}
      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Основная навигация">
        <NavLink className={styles.brand} to="/" onClick={onClose}>
          <span className={styles.logo} aria-hidden="true">Д</span>
          <span><strong>Детки</strong><small>Панель управления</small></span>
        </NavLink>
        <nav className={styles.navigation}>
          <NavLink className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`} to="/" end onClick={onClose}>Обзор</NavLink>
          {navigationGroups.map((group, groupIndex) => {
            const items = group.items.filter(visible);
            if (!items.length) return null;
            const headingId = `navigation-group-${groupIndex}`;
            return (
              <section className={styles.group} key={group.label} aria-labelledby={headingId}>
                <h2 id={headingId}>{group.label}</h2>
                {items.map(item => (
                  <NavLink key={item.to} className={({ isActive }) => {
                    const active = item.to.includes('?') ? `${location.pathname}${location.search}` === item.to : isActive;
                    return `${styles.link} ${active ? styles.active : ''}`;
                  }} to={item.to} onClick={onClose}>{item.label}</NavLink>
                ))}
              </section>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
