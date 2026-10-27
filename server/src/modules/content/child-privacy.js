export function isChildPubliclyVisible(child, now = new Date()) {
  return child?.status === 'PUBLISHED'
    && !child.deletedAt
    && child.publishedAt
    && new Date(child.publishedAt) <= now;
}

export function childMediaArePublishable(child) {
  return (child.media || []).every(link => link.media?.status === 'READY' && link.media?.rightsConfirmed === true);
}
