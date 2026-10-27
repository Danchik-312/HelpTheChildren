import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import styles from './Header.module.css';

export default function Header({ title, onMenuOpen }) {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } catch (_error) { /* Локальная сессия уже очищена. */ } finally { setLoggingOut(false); }
  };
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <button className={styles.menu} type="button" aria-label="Открыть меню" onClick={onMenuOpen}><span /><span /><span /></button>
        <h1>{title}</h1>
      </div>
      <div className={styles.profile}>
        <span className={styles.avatar} aria-hidden="true">{(user?.displayName || user?.email || 'П').charAt(0).toUpperCase()}</span>
        <span className={styles.identity}><strong>{user?.displayName || 'Пользователь'}</strong><small>{user?.role === 'ADMIN' ? 'Администратор' : 'Редактор'}</small></span>
        <button className={styles.logout} type="button" disabled={loggingOut} onClick={handleLogout}>{loggingOut ? 'Выход…' : 'Выйти'}</button>
      </div>
    </header>
  );
}
