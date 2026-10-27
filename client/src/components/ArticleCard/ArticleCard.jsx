import styles from './ArticleCard.module.css';
import RevealImage from '../RevealImage/RevealImage';
import { Link } from 'react-router-dom';

export default function ArticleCard({ article, basePath = '/publications' }) {
  return <article className={styles.card}>
    <Link className={styles.content} to={`${basePath}/${article.slug}`}>
      {article.image && <RevealImage className={styles.image} src={article.image} alt={article.imageAlt || ''} />}
      <h3 className={styles.title}>{article.title}</h3>
      <p className={styles.description}>{article.description}</p>
    </Link>
    <div className={styles.meta}><span>{[article.kindLabel || article.category, ...(article.categoryNames || [])].filter(Boolean).join(' · ')}</span>{article.date && <time dateTime={article.date}>{new Intl.DateTimeFormat('ru-RU').format(new Date(article.date))}</time>}</div>
  </article>;
}
