import styles from './PencilLink.module.css';

export default function PencilLink({ as: Tag = 'a', children, className, ...props }) {
  const linkClass = [styles.link, className].filter(Boolean).join(' ');
  return <Tag className={linkClass} {...props}>{children}</Tag>;
}
