import Container from '../Container/Container';
import { Link } from 'react-router-dom';
import logo from '../../assets/brand/logo.png';
import { useSite } from '../../hooks/useContent';
import styles from './Footer.module.css';

export default function Footer() {
  const { data: site } = useSite();
  const organization = site?.organization;
  const contacts = site?.contacts || [];
  const officeAddress = contacts.find(contact => contact.type === 'ADDRESS')?.value;
  const mapUrl = officeAddress ? `https://www.google.com/maps?q=${encodeURIComponent(officeAddress)}&output=embed` : null;
  const displayName = organization?.displayName || 'Help The Children SKD';
  return <footer id="contacts" className={styles.footer}><Container className={styles.container}>
    <div className={styles.brandColumn}>
      <Link to="/" className={styles.brand} aria-label={`${displayName}, главная`}><img src={logo} alt="" /></Link>
      <address className={styles.contacts} aria-label="Контактные данные">
        {contacts.map(contact => <div className={styles.contact} key={contact.id}>
          <span>{contact.label}</span>
          {contact.href && contact.href !== '/contacts'
            ? <a href={contact.href}>{contact.value}</a>
            : <strong>{contact.value}</strong>}
        </div>)}
      </address>
    </div>
    <div className={styles.content}>
      {mapUrl
        ? <div className={styles.map}><iframe src={mapUrl} title={`Офис ${displayName}: ${officeAddress}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /></div>
        : <div className={styles.mapFallback}>Адрес офиса пока не опубликован.</div>}
    </div>
    <p className={styles.copyright}>© {new Date().getFullYear()} {displayName}.</p>
  </Container></footer>;
}
