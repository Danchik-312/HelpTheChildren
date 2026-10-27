import classNames from 'classnames';
import Container from '../Container/Container';
import styles from './ContentState.module.css';

export default function ContentState({ loading, error, empty, emptyMessage = 'Материалы пока не опубликованы.' }) {
  if (!loading && !error && !empty) return null;
  return <Container as="section" className={classNames(styles.state, { [styles.loading]: loading, [styles.error]: error, [styles.empty]: empty })} aria-live="polite" aria-busy={loading || undefined}>
    {loading && <p className={styles.message}>Загружаем материалы…</p>}
    {error && <p className={styles.message} role="alert">Не удалось загрузить материалы. Попробуйте обновить страницу.</p>}
    {!loading && !error && empty && <p className={styles.message}>{emptyMessage}</p>}
  </Container>;
}
