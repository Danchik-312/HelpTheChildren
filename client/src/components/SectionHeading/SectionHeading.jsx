import classNames from 'classnames';
import styles from './SectionHeading.module.css';

export default function SectionHeading({ id, title, children, light = false, compact = false }) {
  return <div className={classNames(styles.heading, { [styles.light]: light, [styles.compact]: compact })}>
    <h2 id={id} className={styles.title}>{title}</h2>
    {children && <p className={styles.description}>{children}</p>}
  </div>;
}
