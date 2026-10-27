import { useEffect, useState } from 'react';
import { apiBlobRequest } from '../api/apiClient';

export default function PrivateMediaPreview({ media, className = '', alt = '' }) {
  const [url, setUrl] = useState(media?.externalUrl || '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!media || media.externalUrl) {
      setUrl(media?.externalUrl || '');
      return undefined;
    }
    let active = true;
    let objectUrl;
    setUrl('');
    setFailed(false);
    apiBlobRequest(`/admin/media/${media.id}/content`)
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media]);

  if (!media) return null;
  if (failed) return <span className={className} role="img" aria-label="Предпросмотр недоступен">◫</span>;
  if (!url) return <span className={className} aria-hidden="true">…</span>;
  if (media.kind === 'IMAGE') return <img className={className} src={url} alt={alt || media.defaultAlt || ''} />;
  if (media.kind === 'VIDEO') return <video className={className} src={url} controls preload="metadata" />;
  if (media.kind === 'EXTERNAL_VIDEO') return <a href={url} target="_blank" rel="noreferrer">Открыть видео</a>;
  return <a href={url} target="_blank" rel="noreferrer">Открыть файл</a>;
}
