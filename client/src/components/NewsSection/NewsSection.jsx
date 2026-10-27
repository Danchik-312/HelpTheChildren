import Container from '../Container/Container';
import SectionHeading from '../SectionHeading/SectionHeading';
import TextLink from '../TextLink/TextLink';
import ArticleCard from '../ArticleCard/ArticleCard';
import ContentState from '../ContentState/ContentState';
import { useCollection } from '../../hooks/useContent';
import styles from './NewsSection.module.css';

export default function NewsSection({ heading, description, itemLimit }) {
  const { data: articles, loading, error } = useCollection('publications', { pageSize: itemLimit || 3 });
  return <section id="news" className={styles.section} aria-labelledby="news-title"><Container>
    <div className={styles.heading}><SectionHeading id="news-title" title={heading || 'Публикации'}>{description}</SectionHeading><TextLink to="/publications">Еще</TextLink></div>
    {loading || error || articles.length === 0 ? <ContentState loading={loading} error={error} empty={!loading && !error && articles.length === 0} /> : <div className={styles.grid}>{articles.slice(0, itemLimit || 3).map(article => <ArticleCard key={article.id} article={article} />)}</div>}
  </Container></section>;
}
