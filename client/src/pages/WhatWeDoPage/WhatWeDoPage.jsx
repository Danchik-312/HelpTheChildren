import { useState } from 'react';
import Container from '../../components/Container/Container';
import PageIntro from '../../components/PageIntro/PageIntro';
import PageTabs from '../../components/PageTabs/PageTabs';
import SectionGrid from '../../components/SectionGrid/SectionGrid';
import ContentState from '../../components/ContentState/ContentState';
import Pagination from '../../components/Pagination/Pagination';
import { usePaginatedCollection } from '../../hooks/useContent';
import styles from './WhatWeDoPage.module.css';

const tabs = [{ label: 'Проекты', kind: 'PROJECT' }, { label: 'Программы', kind: 'PROGRAM' }, { label: 'Инициативы', kind: 'INITIATIVE' }];

export default function WhatWeDoPage() {
  const [active, setActive] = useState(tabs[0]);
  const [page, setPage] = useState(1);
  const { data: projects, meta, loading, error } = usePaginatedCollection('projects', { kind: active.kind, page, pageSize: 12 });
  const items = projects.map(item => ({ ...item, to: `/projects/${item.slug}` }));
  const changeTab = label => { setActive(tabs.find(tab => tab.label === label) || tabs[0]); setPage(1); };
  return <><PageIntro title="Что мы делаем">Проекты, программы и инициативы организации.</PageIntro><Container className={styles.tabs}><PageTabs items={tabs.map(tab => tab.label)} active={active.label} onChange={changeTab} variant="plain" /></Container>{loading || error || items.length === 0 ? <ContentState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyMessage="В этом разделе пока нет материалов." /> : <SectionGrid key={active.kind} items={items} label={active.label} />} {!loading && !error && <Pagination page={page} totalPages={meta?.totalPages} onChange={setPage} label={`Страницы: ${active.label}`} />}</>;
}
