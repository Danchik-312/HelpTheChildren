import { useState } from 'react';
import PageIntro from '../../components/PageIntro/PageIntro';
import SectionGrid from '../../components/SectionGrid/SectionGrid';
import ContentState from '../../components/ContentState/ContentState';
import StructuredContent from '../../components/StructuredContent/StructuredContent';
import Container from '../../components/Container/Container';
import { usePaginatedCollection, useSite } from '../../hooks/useContent';
import Pagination from '../../components/Pagination/Pagination';

export default function WhoWePage() {
  const [page, setPage] = useState(1);
  const { data, meta, loading, error } = usePaginatedCollection('organizationSections', { page, pageSize: 12 });
  const { data: site, loading: siteLoading, error: siteError } = useSite();
  const items = data.map(item => ({ ...item, to: `/who-we/${item.slug}` }));
  const organization = site?.organization;
  const intro = organization?.shortDescription || 'Информация об организации.';
  return <>
    <PageIntro title={organization?.displayName || 'Кто мы'}>{intro}</PageIntro>
    {organization?.description && <Container as="section"><StructuredContent content={organization.description} /></Container>}
    {loading || siteLoading || error || siteError || items.length === 0
      ? <ContentState loading={loading || siteLoading} error={error || siteError} empty={!loading && !siteLoading && !error && !siteError && items.length === 0} emptyMessage="Дополнительные разделы пока не опубликованы." />
      : <SectionGrid items={items} label="Информация об организации" columns={2} />}
    {!loading && !error && <Pagination page={page} totalPages={meta?.totalPages} onChange={setPage} label="Страницы об организации" />}
  </>;
}
