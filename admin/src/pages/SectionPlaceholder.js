import styles from './SectionPlaceholder.module.css';

export default function SectionPlaceholder({ title }) {
  return (
    <section className={styles.card}>
      <span className={styles.marker} aria-hidden="true" />
      <h2>{title}</h2>
      <p>Раздел подключается к реальному API на следующем согласованном этапе.</p>
    </section>
  );
}
