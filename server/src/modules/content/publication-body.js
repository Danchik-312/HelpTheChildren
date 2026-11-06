export function readPublicationBody(value) {
  return value?.format === 'publication-with-side-photos'
    ? { body: value.document, sidePhotos: value.sidePhotos }
    : { body: value, sidePhotos: [] };
}

export function writePublicationBody(document, sidePhotos) {
  return sidePhotos.length ? { format: 'publication-with-side-photos', document, sidePhotos } : document;
}

export function adminPublication(item) {
  const { media, ...fields } = item;
  const { body, sidePhotos } = readPublicationBody(item.body);
  const assets = new Map((media || []).map(link => [link.mediaId, link.media]));
  return { ...fields, body, sidePhotos: sidePhotos.map(photo => {
    const asset = assets.get(photo.mediaId);
    return {
      ...photo,
      media: asset ? { id: asset.id, kind: asset.kind, defaultAlt: asset.defaultAlt, originalName: asset.originalName } : null,
    };
  }) };
}
