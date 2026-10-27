import classNames from 'classnames';
import styles from './Container.module.css';

export default function Container({ as: Tag = 'div', className, children, ...props }) {
  return <Tag className={classNames(styles.container, className)} {...props}>{children}</Tag>;
}
