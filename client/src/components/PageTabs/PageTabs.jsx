import classNames from 'classnames';
import styles from './PageTabs.module.css';

export default function PageTabs({ items, active, onChange, variant = 'pill' }) {
  return <div className={classNames(styles.tabs, { [styles.plainTabs]: variant === 'plain' })} role="group" aria-label="Фильтры материалов">
    {variant === 'plain' && <select className={styles.select} value={active} onChange={event => onChange(event.target.value)} aria-label="Выбрать раздел">{items.map(item => <option key={item}>{item}</option>)}</select>}
    {items.map(item => <button key={item} type="button" aria-pressed={active === item}
      className={classNames(styles.tab, styles[variant], { [styles.active]: active === item })} onClick={() => onChange(item)}>{item}</button>)}
  </div>;
}
