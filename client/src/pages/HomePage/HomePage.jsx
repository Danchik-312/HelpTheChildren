import Hero from '../../components/Hero/Hero';
import ChildrenSection from '../../components/ChildrenSection/ChildrenSection';
import HelpSection from '../../components/HelpSection/HelpSection';
import ProjectsSection from '../../components/ProjectsSection/ProjectsSection';
import NewsSection from '../../components/NewsSection/NewsSection';
import FriendsSection from '../../components/FriendsSection/FriendsSection';
import ContentState from '../../components/ContentState/ContentState';
import { useHomepage } from '../../hooks/useContent';
import styles from './HomePage.module.css';

const blocks = {
  children: ChildrenSection,
  help: HelpSection,
  projects: ProjectsSection,
  publications: NewsSection,
  friends: FriendsSection,
};

const defaultBlocks = [
  { key: 'children' },
  { key: 'help' },
  { key: 'projects' },
  { key: 'publications' },
  { key: 'friends' },
];

export default function HomePage() {
  const { data, loading, error } = useHomepage();
  const homepageBlocks = (data.length > 0 ? data : defaultBlocks).filter(block => blocks[block.key]);
  return <div className={styles.page}>
    <Hero />
    {loading || error ? <ContentState loading={loading} error={error} /> : homepageBlocks.map((block, index) => {
      const Component = blocks[block.key];
      return <div key={block.key} className={index % 2 === 0 ? styles.surfaceBlock : styles.highlightBlock}>
        <Component heading={block.heading} description={block.description} itemLimit={block.itemLimit} config={block.config} />
      </div>;
    })}
  </div>;
}
