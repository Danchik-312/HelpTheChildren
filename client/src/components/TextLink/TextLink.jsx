import classNames from 'classnames';
import { Link } from 'react-router-dom';
import styles from './TextLink.module.css';

export default function TextLink({ children, className, light = false, to, ...props }) {
  const linkClass = classNames(styles.link, className, { [styles.light]: light });
  return to
    ? <Link className={linkClass} to={to} {...props}>{children}</Link>
    : <a className={linkClass} {...props}>{children}</a>;
}
