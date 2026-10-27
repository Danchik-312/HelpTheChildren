import { Fragment } from 'react';
import PrivateMediaPreview from './PrivateMediaPreview';
import { safeImageAttrs, safeLinkHref } from './contentSafety';

function renderText(node, key) {
  if (typeof node.text !== 'string') return null;
  let result = node.text;
  const marks = Array.isArray(node.marks) ? node.marks : [];
  marks.forEach((mark, index) => {
    if (mark?.type === 'bold') result = <strong key={`${key}-bold-${index}`}>{result}</strong>;
    if (mark?.type === 'italic') result = <em key={`${key}-italic-${index}`}>{result}</em>;
    if (mark?.type === 'link') {
      const href = safeLinkHref(mark.attrs?.href);
      if (href) result = <a key={`${key}-link-${index}`} href={href} rel="noopener noreferrer">{result}</a>;
    }
  });
  return result;
}

function childrenOf(node, key) {
  return Array.isArray(node?.content) ? node.content.map((child, index) => renderNode(child, `${key}-${index}`)) : null;
}

function renderNode(node, key) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'text') return <Fragment key={key}>{renderText(node, key)}</Fragment>;
  if (node.type === 'hardBreak') return <br key={key} />;
  if (node.type === 'paragraph') return <p key={key}>{childrenOf(node, key)}</p>;
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level);
    if (![2, 3, 4].includes(level)) return null;
    const Heading = `h${level}`;
    return <Heading key={key}>{childrenOf(node, key)}</Heading>;
  }
  if (node.type === 'bulletList') return <ul key={key}>{childrenOf(node, key)}</ul>;
  if (node.type === 'orderedList') return <ol key={key}>{childrenOf(node, key)}</ol>;
  if (node.type === 'listItem') return <li key={key}>{childrenOf(node, key)}</li>;
  if (node.type === 'blockquote') return <blockquote key={key}>{childrenOf(node, key)}</blockquote>;
  if (node.type === 'image') {
    const attrs = safeImageAttrs(node.attrs);
    if (!attrs) return null;
    return <PrivateMediaPreview key={key} media={{ id: attrs.mediaId, kind: 'IMAGE', defaultAlt: attrs.alt }} alt={attrs.alt} />;
  }
  return null;
}

export default function StructuredContent({ value }) {
  const nodes = value?.type === 'doc' && Array.isArray(value.content) ? value.content : [];
  const rendered = nodes.map((node, index) => renderNode(node, `content-${index}`)).filter(Boolean);
  if (!rendered.length) return <p>Содержимое пока не добавлено.</p>;
  return <div>{rendered}</div>;
}
