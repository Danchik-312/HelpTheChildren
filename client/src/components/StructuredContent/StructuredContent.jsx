import React from 'react';
import styles from './StructuredContent.module.css';

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_LINK_SCHEMES = /^(?:https:\/\/|mailto:|\/)/i;
const NODE_KEYS = {
  doc: ['type', 'content'], paragraph: ['type', 'content'], heading: ['type', 'attrs', 'content'],
  bulletList: ['type', 'content'], orderedList: ['type', 'attrs', 'content'], listItem: ['type', 'content'],
  blockquote: ['type', 'content'], text: ['type', 'text', 'marks'], hardBreak: ['type'], image: ['type', 'attrs'],
};

function onlyKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
}

function safeHref(href) {
  if (typeof href !== 'string' || href.length > 2048 || href.includes('\\') || [...href].some(char => char.charCodeAt(0) <= 0x20) || !SAFE_LINK_SCHEMES.test(href)) return null;
  if (href.startsWith('/')) return href.startsWith('//') ? null : href;
  if (href.startsWith('mailto:')) return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href) ? href : null;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function imageSource(attrs) {
  if (!attrs || !onlyKeys(attrs, ['mediaId', 'alt', 'title'])) return null;
  return typeof attrs.mediaId === 'string' && UUID.test(attrs.mediaId)
    ? `${API_BASE_URL}/public/media/${encodeURIComponent(attrs.mediaId)}`
    : null;
}

function applyMarks(children, marks) {
  if (marks === undefined) return children;
  if (!Array.isArray(marks) || marks.length > 8) return null;
  return marks.reduce((result, mark) => {
    if (!mark || !['bold', 'italic', 'link'].includes(mark.type)) return null;
    if (mark.type === 'bold' || mark.type === 'italic') {
      if (!onlyKeys(mark, ['type'])) return null;
      return mark.type === 'bold' ? <strong>{result}</strong> : <em>{result}</em>;
    }
    if (!onlyKeys(mark, ['type', 'attrs']) || !onlyKeys(mark.attrs, ['href', 'target', 'rel', 'class'])) return null;
    const href = safeHref(mark.attrs.href);
    if (!href || (mark.attrs.target != null && !['_self', '_blank'].includes(mark.attrs.target)) || (mark.attrs.class != null)) return null;
    return <a href={href} target={mark.attrs.target === '_blank' ? '_blank' : undefined} rel={mark.attrs.target === '_blank' ? 'noopener noreferrer' : undefined}>{result}</a>;
  }, children);
}

function renderNode(node, key) {
  if (!node || typeof node.type !== 'string' || !NODE_KEYS[node.type] || !onlyKeys(node, NODE_KEYS[node.type])) return null;
  const children = Array.isArray(node.content) ? node.content.map((child, index) => renderNode(child, index)).filter(child => child !== null) : [];
  switch (node.type) {
    case 'doc': return <React.Fragment key={key}>{children}</React.Fragment>;
    case 'paragraph': return <p key={key}>{children}</p>;
    case 'heading': {
      if (!onlyKeys(node.attrs, ['level']) || !Number.isInteger(node.attrs.level) || node.attrs.level < 1 || node.attrs.level > 6) return null;
      const Tag = `h${node.attrs.level}`;
      return <Tag key={key}>{children}</Tag>;
    }
    case 'bulletList': return <ul key={key}>{children}</ul>;
    case 'orderedList': {
      if (node.attrs !== undefined && (!onlyKeys(node.attrs, ['start']) || !Number.isInteger(node.attrs.start) || node.attrs.start < 1 || node.attrs.start > 1_000_000)) return null;
      return <ol key={key} start={node.attrs?.start}>{children}</ol>;
    }
    case 'listItem': return <li key={key}>{children}</li>;
    case 'blockquote': return <blockquote key={key}>{children}</blockquote>;
    case 'text': return typeof node.text === 'string' ? <React.Fragment key={key}>{applyMarks(node.text, node.marks)}</React.Fragment> : null;
    case 'hardBreak': return <br key={key} />;
    case 'image': {
      const src = imageSource(node.attrs);
      if (!src || (node.attrs.alt !== undefined && node.attrs.alt !== null && typeof node.attrs.alt !== 'string') || (node.attrs.title !== undefined && node.attrs.title !== null && typeof node.attrs.title !== 'string')) return null;
      return <span className={styles.figure} key={key}><img className={styles.image} src={src} alt={node.attrs.alt || ''} title={node.attrs.title || undefined} loading="lazy" decoding="async" /></span>;
    }
    default: return null;
  }
}

export default function StructuredContent({ content, className }) {
  if (Array.isArray(content)) {
    const legacy = content.filter(block => block && block.type === 'paragraph' && onlyKeys(block, ['type', 'text']) && typeof block.text === 'string');
    if (!legacy.length) return null;
    return <div className={[styles.content, className].filter(Boolean).join(' ')}>{legacy.map((block, index) => <p key={index}>{block.text}</p>)}</div>;
  }
  if (!content || content.type !== 'doc' || !onlyKeys(content, NODE_KEYS.doc) || !Array.isArray(content.content)) return null;
  return <div className={[styles.content, className].filter(Boolean).join(' ')}>{content.content.map((node, index) => renderNode(node, index))}</div>;
}
