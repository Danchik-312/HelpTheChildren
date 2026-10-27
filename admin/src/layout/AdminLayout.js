import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import styles from './AdminLayout.module.css';

const titles = [
  ['/publications', 'Публикации'], ['/stories', 'Истории'], ['/children', 'Дети'], ['/projects', 'Проекты и программы'],
  ['/pages', 'Информационные страницы'], ['/media', 'Медиатека'], ['/hero', 'Hero и баннеры'],
  ['/settings/contacts', 'Контакты'], ['/settings/organization', 'Об организации'], ['/settings/home', 'Блоки главной'],
  ['/users', 'Пользователи и роли'], ['/audit-log', 'Журнал аудита'], ['/', 'Обзор'],
];

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const title = titles.find(([prefix]) => prefix === '/' ? pathname === '/' : pathname.startsWith(prefix))?.[1] || 'Панель управления';
  return (
    <div className={styles.shell}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className={styles.main}>
        <Header title={title} onMenuOpen={() => setMenuOpen(true)} />
        <main className={styles.content}><Outlet /></main>
      </div>
    </div>
  );
}
