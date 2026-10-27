import Container from '../Container/Container';
import SectionHeading from '../SectionHeading/SectionHeading';
import TextLink from '../TextLink/TextLink';
import styles from './FriendsSection.module.css';

export default function FriendsSection({ heading, description }) {
  return <section id="friends" className={styles.section} aria-labelledby="friends-title"><Container className={styles.container}>
    <div className={styles.content}>
      <SectionHeading id="friends-title" title={heading || 'Стать частью команды'} light>{description || 'Присоединяйтесь к волонтёрам, партнёрам и сторонникам организации.'}</SectionHeading>
      <TextLink to="/give-help/volunteer" light>Узнать подробнее →</TextLink>
    </div>
  </Container></section>;
}
