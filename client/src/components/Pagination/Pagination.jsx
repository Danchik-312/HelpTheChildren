import Container from '../Container/Container';
import styles from './Pagination.module.css';

export default function Pagination({ page = 1, totalPages = 0, onChange, label = 'Страницы' }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(number => totalPages <= 7 || number === 1 || number === totalPages || Math.abs(number - page) <= 1);
  return <Container as="nav" className={styles.pagination} aria-label={label}>
    <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Предыдущая страница">←</button>
    {pages.map((number, index) => <span key={number} className={styles.item}>{index > 0 && number - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}<button type="button" className={number === page ? styles.current : undefined} aria-current={number === page ? 'page' : undefined} aria-label={`Страница ${number}`} onClick={() => onChange(number)}>{number}</button></span>)}
    <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Следующая страница">→</button>
  </Container>;
}
