import Container from '../Container/Container';
import SectionHeading from '../SectionHeading/SectionHeading';
import TextLink from '../TextLink/TextLink';
import ContentState from '../ContentState/ContentState';
import { useCollection } from '../../hooks/useContent';
import { Link } from 'react-router-dom';
import styles from './ProjectsSection.module.css';

export default function ProjectsSection({ heading, description, itemLimit }) {
  const limit = Math.min(itemLimit || 3, 3);
  const { data: projects, loading, error } = useCollection('projects', { pageSize: limit });
  return <section id="projects" className={styles.section} aria-labelledby="projects-title"><Container>
    <SectionHeading id="projects-title" title={heading || 'Проекты'} light>{description || 'Проекты, программы и инициативы организации.'}</SectionHeading>
    {loading || error || projects.length === 0 ? <ContentState loading={loading} error={error} empty={!loading && !error && projects.length === 0} /> : <ul className={styles.list}>{projects.slice(0, limit).map(project => <li key={project.id}><Link to={`/projects/${project.slug}`}>{project.title}</Link></li>)}</ul>}
    <TextLink className={styles.more} to="/what-we-do" light>Все проекты</TextLink>
  </Container></section>;
}
