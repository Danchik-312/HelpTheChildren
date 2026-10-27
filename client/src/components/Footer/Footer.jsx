import { useEffect, useState } from 'react';
import Container from '../Container/Container';
import { Link } from 'react-router-dom';
import logo from '../../assets/brand/logo.png';
import { contentRepository } from '../../services/contentRepository';
import { useSite } from '../../hooks/useContent';
import styles from './Footer.module.css';

export default function Footer() {
  const { data: site } = useSite();
  const [navigation, setNavigation] = useState([]);
  useEffect(() => {
    let active = true;
    contentRepository.navigation().then(items => { if (active) setNavigation(items); }).catch(() => { if (active) setNavigation([]); });
    return () => { active = false; };
  }, []);
  const organization = site?.organization;
  const displayName = organization?.displayName || 'Help The Children SKD';
  return <footer id="contacts" className={styles.footer}><Container className={styles.container}>
    <Link to="/" className={styles.brand} aria-label={`${displayName}, главная`}><img src={logo} alt="" /></Link>
    <div className={styles.content}>
      <nav className={styles.navigation} aria-label="Навигация в подвале">{navigation.map(item => <Link key={item.to} to={item.to}>{item.title}</Link>)}</nav>
      <p className={styles.copyright}>© {new Date().getFullYear()} {displayName}.</p>
    </div>
  </Container></footer>;
}
