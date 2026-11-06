import { useState } from 'react';
import Container from '../../components/Container/Container';
import ContentState from '../../components/ContentState/ContentState';
import PageIntro from '../../components/PageIntro/PageIntro';
import { useEntry } from '../../hooks/useContent';
import { publicImageUrlById } from '../../services/contentRepository';
import styles from './PartnersPage.module.css';

function readPartners(body) {
  if (body?.type !== 'doc' || !Array.isArray(body.content)) return [];
  return body.content.flatMap((node, index, blocks) => {
    if (node?.type !== 'heading' || !Array.isArray(node.content)) return [];
    const name = node.content.map(part => {
      if (part?.type === 'hardBreak') return ' ';
      return part?.type === 'text' && typeof part.text === 'string' ? part.text : '';
    }).join('').trim();
    if (!name) return [];
    const next = blocks[index + 1];
    const imageUrl = next?.type === 'image' ? publicImageUrlById(next.attrs?.mediaId) : undefined;
    return [{ key: index, name, imageUrl }];
  });
}

function PartnersList({ body }) {
  const [failedImages, setFailedImages] = useState(new Set());
  const partners = readPartners(body);
  if (!partners.length) return <ContentState empty emptyMessage="Список партнёров пока не опубликован." />;

  const withLogos = [];
  const withoutLogos = [];
  for (const partner of partners) {
    const group = partner.imageUrl && !failedImages.has(partner.imageUrl) ? withLogos : withoutLogos;
    group.push(partner);
  }

  return <Container className={styles.partners}>
    {withLogos.length > 0 && <ul className={styles.logoGrid} aria-label="Партнёры с логотипами">
      {withLogos.map(({ key, name, imageUrl }) => <li className={styles.card} key={key}>
        <img src={imageUrl} alt="" loading="lazy" decoding="async" onError={() => {
          setFailedImages(current => new Set([...current, imageUrl]));
        }} />
        <span>{name}</span>
      </li>)}
    </ul>}
    {withoutLogos.length > 0 && <section className={styles.other} aria-labelledby="other-partners">
      <h2 id="other-partners">Другие партнёры</h2>
      <ul>{withoutLogos.map(({ key, name }) => <li key={key}>{name}</li>)}</ul>
    </section>}
  </Container>;
}

export default function PartnersPage() {
  const { data: page, loading, error } = useEntry('generalPages', 'partners');
  return <>
    <PageIntro title={page?.title || 'Партнёры'} compact>{page?.description}</PageIntro>
    {loading || error
      ? <ContentState loading={loading} error={error} />
      : <PartnersList body={page?.body} key={page?.id} />}
  </>;
}
