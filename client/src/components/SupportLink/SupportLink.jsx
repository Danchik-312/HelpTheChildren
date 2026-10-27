import { Link } from 'react-router-dom';
import styles from './SupportLink.module.css';

export default function SupportLink() {
  return <Link className={styles.link} to="/get-help"><span className={styles.plus} aria-hidden="true" />Получить помощь</Link>;
}
