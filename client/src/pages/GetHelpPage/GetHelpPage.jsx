import { useState } from 'react';
import PageIntro from '../../components/PageIntro/PageIntro';
import SectionGrid from '../../components/SectionGrid/SectionGrid';
import ContentState from '../../components/ContentState/ContentState';
import { usePaginatedCollection } from '../../hooks/useContent';
import Pagination from '../../components/Pagination/Pagination';

export default function GetHelpPage() {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error } = usePaginatedCollection('getHelpDirections', { page, pageSize: 12 });
  const items = data.map(item => ({ ...item, to: `/get-help/${item.slug}` }));
  return <><PageIntro title="Получить помощь" compact>Выберите подходящее направление, чтобы узнать условия и порядок обращения.</PageIntro>{loading || error || items.length === 0 ? <ContentState loading={loading} error={error} empty={!loading && !error && items.length === 0} /> : <SectionGrid items={items} label="Направления помощи" tone="tinted" />} {!loading && !error && <Pagination page={page} totalPages={meta?.totalPages} onChange={setPage} label="Страницы направлений помощи" />}</>;
}
