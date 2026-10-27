import { Link } from 'react-router-dom';
import Container from '../../components/Container/Container';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  return <Container as="section" className={styles.page}><p className={styles.code}>404</p><h1>Страница не найдена</h1><p>Материал ещё не опубликован или адрес указан неверно.</p><Link to="/">Вернуться на главную →</Link></Container>;
}
