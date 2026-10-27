import { Link, useParams } from 'react-router-dom';
import PageIntro from '../../components/PageIntro/PageIntro';
import Container from '../../components/Container/Container';
import ContentState from '../../components/ContentState/ContentState';
import StructuredContent from '../../components/StructuredContent/StructuredContent';
import NotFoundPage from '../NotFoundPage/NotFoundPage';
import { useEntry } from '../../hooks/useContent';
import styles from './ContentDetailPage.module.css';

export default function ContentDetailPage({ collection, backTo, backLabel }) {
  const { slug } = useParams();
  const { data: entry, loading, error } = useEntry(collection, slug);
  if (loading || error) return <ContentState loading={loading} error={error} />;
  if (!entry) return <NotFoundPage />;
  const title = collection === 'children' ? entry.name : entry.title || entry.name;
  const details = [
    entry.category && ['Категория', entry.category],
    entry.date && ['Дата', new Intl.DateTimeFormat('ru-RU').format(new Date(entry.date))],
    entry.age && ['Возраст', entry.age],
    entry.disease && ['Информация', entry.disease],
  ].filter(Boolean);
  const textDetails = [...new Set([entry.summary, entry.supportReason].filter(value => typeof value === 'string' && value.trim()))];
  const structuredBody = entry.body || entry.instructions;
  return <>
    <PageIntro title={title} image={entry.image} imageAlt={entry.imageAlt || ''}>
      {entry.description}
    </PageIntro>
    <Container as="article" className={styles.article}>
      {details.length > 0 && <dl className={styles.details}>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      {structuredBody && <StructuredContent content={structuredBody} className={styles.body} />}
      {textDetails.map((paragraph, index) => <p className={styles.body} key={`${index}-${paragraph}`}>{paragraph}</p>)}
      {!structuredBody && textDetails.length === 0 && <p className={styles.body}>Для этого материала нет дополнительного текста.</p>}
      <Link className={styles.back} to={backTo}>← {backLabel}</Link>
    </Container>
  </>;
}
