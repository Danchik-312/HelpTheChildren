import { useState } from 'react';
import PageIntro from '../../components/PageIntro/PageIntro';
import SectionGrid from '../../components/SectionGrid/SectionGrid';
import ContentState from '../../components/ContentState/ContentState';
import { usePaginatedCollection } from '../../hooks/useContent';
import Pagination from '../../components/Pagination/Pagination';

export default function GiveHelpPage() {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error } = usePaginatedCollection('helpMethods', { page, pageSize: 12 });
  return <><PageIntro title="Помочь">Выберите подходящий формат участия в работе организации.</PageIntro>{loading || error || data.length === 0 ? <ContentState loading={loading} error={error} empty={!loading && !error && data.length === 0} /> : <SectionGrid items={data} label="Способы помочь" />} {!loading && !error && <Pagination page={page} totalPages={meta?.totalPages} onChange={setPage} label="Страницы способов помочь" />}</>;
}
