import { useEffect, useState } from 'react';
import classNames from 'classnames';
import Container from '../../components/Container/Container';
import PageIntro from '../../components/PageIntro/PageIntro';
import PageTabs from '../../components/PageTabs/PageTabs';
import ArticleCard from '../../components/ArticleCard/ArticleCard';
import ContentState from '../../components/ContentState/ContentState';
import { usePaginatedCollection } from '../../hooks/useContent';
import { contentRepository } from '../../services/contentRepository';
import Pagination from '../../components/Pagination/Pagination';
import styles from './PublicationsPage.module.css';

const kinds = [{ label: 'Все', value: '' }, { label: 'Новости', value: 'NEWS' }, { label: 'Статьи', value: 'ARTICLE' }];
const pageSize = 9;

export default function PublicationsPage() {
  const [kind, setKind] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const { data: articles, meta, loading, error } = usePaginatedCollection('publications', { page, pageSize, kind, categoryId });

  useEffect(() => {
    let active = true;
    if (!kind) { setCategories([]); setCategoryId(''); return undefined; }
    contentRepository.categories(kind).then(items => { if (active) setCategories(items); }).catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [kind]);

  const selectKind = label => {
    setKind(kinds.find(item => item.label === label)?.value || '');
    setCategoryId('');
    setPage(1);
  };
  return <>
    <PageIntro title="Публикации">Новости, статьи и материалы организации.</PageIntro>
    <Container className={styles.filters}>
      <PageTabs items={kinds.map(item => item.label)} active={kinds.find(item => item.value === kind)?.label || 'Все'} onChange={selectKind} variant="plain" />
      {kind && categories.length > 0 && <label className={styles.categoryFilter}><span>Категория</span><select value={categoryId} onChange={event => { setCategoryId(event.target.value); setPage(1); }}><option value="">Все категории</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}
    </Container>
    {loading || error || articles.length === 0
      ? <ContentState loading={loading} error={error} empty={!loading && !error && articles.length === 0} emptyMessage="В этом разделе пока нет публикаций." />
      : <Container as="section" className={classNames(styles.grid, { [styles.filtered]: kind || categoryId })} aria-live="polite">{articles.map(article => <ArticleCard key={article.id} article={article} />)}</Container>}
    {!loading && !error && <Pagination page={page} totalPages={meta?.totalPages} onChange={setPage} label="Страницы публикаций" />}
  </>;
}
