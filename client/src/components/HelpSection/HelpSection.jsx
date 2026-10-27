import Container from '../Container/Container';
import SectionHeading from '../SectionHeading/SectionHeading';
import PencilLink from '../PencilLink/PencilLink';
import ContentState from '../ContentState/ContentState';
import { useCollection } from '../../hooks/useContent';
import { Link } from 'react-router-dom';
import styles from './HelpSection.module.css';

export default function HelpSection({ heading, description, itemLimit }) {
  const { data: help, loading, error } = useCollection('helpMethods', { pageSize: itemLimit || 6 });
  return <section id="help" className={styles.section} aria-labelledby="help-title">
    <Container>
      <SectionHeading id="help-title" title={heading || 'Как помочь?'} compact>{description || 'Выберите подходящий формат участия в работе организации.'}</SectionHeading>
      <div className={styles.content}>{loading || error || help.length === 0
        ? <ContentState loading={loading} error={error} empty={!loading && !error && help.length === 0} />
        : <ul className={styles.ways}>{help.slice(0, itemLimit || help.length).map(item => <li key={item.id}><PencilLink as={Link} to={item.to}>{item.title}</PencilLink></li>)}</ul>}
      </div>
    </Container>
  </section>;
}
