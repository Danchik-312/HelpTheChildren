import { useState } from 'react';
import PageIntro from '../../components/PageIntro/PageIntro';
import SectionGrid from '../../components/SectionGrid/SectionGrid';
import ContentState from '../../components/ContentState/ContentState';
import { usePaginatedCollection } from '../../hooks/useContent';
import Pagination from '../../components/Pagination/Pagination';

export default function CollectionPage({ title, description, collection, basePath, emptyMessage }) {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error } = usePaginatedCollection(collection, { page, pageSize: 12 });
  const items = data.map(item => ({ ...item, to: `${basePath}/${item.slug}` }));
  return <>
    <PageIntro title={title}>{description}</PageIntro>
    {loading || error || items.length === 0
      ? <ContentState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyMessage={emptyMessage} />
      : <SectionGrid items={items} label={title} columns={collection === 'children' ? 4 : 2} showImages={collection === 'children'} />}
    {!loading && !error && <Pagination page={page} totalPages={meta?.totalPages} onChange={setPage} label={`Страницы: ${title}`} />}
  </>;
}
