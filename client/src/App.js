import { Route, Routes } from 'react-router-dom';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import SupportLink from './components/SupportLink/SupportLink';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import HomePage from './pages/HomePage/HomePage';
import GiveHelpPage from './pages/GiveHelpPage/GiveHelpPage';
import GetHelpPage from './pages/GetHelpPage/GetHelpPage';
import WhatWeDoPage from './pages/WhatWeDoPage/WhatWeDoPage';
import WhoWePage from './pages/WhoWePage/WhoWePage';
import PublicationsPage from './pages/PublicationsPage/PublicationsPage';
import CollectionPage from './pages/CollectionPage/CollectionPage';
import ContentDetailPage from './pages/ContentDetailPage/ContentDetailPage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';

export default function App() {
  return <>
    <ScrollToTop />
    <Header />
    <main id="main">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/give-help" element={<GiveHelpPage />} />
        <Route path="/get-help" element={<GetHelpPage />} />
        <Route path="/what-we-do" element={<WhatWeDoPage />} />
        <Route path="/who-we" element={<WhoWePage />} />
        <Route path="/publications" element={<PublicationsPage />} />
        <Route path="/publications/:slug" element={<ContentDetailPage collection="publications" backTo="/publications" backLabel="К публикациям" />} />
        <Route path="/stories" element={<CollectionPage title="Истории" description="Истории детей, семей и проектов организации." collection="stories" basePath="/stories" emptyMessage="Истории пока не опубликованы." />} />
        <Route path="/stories/:slug" element={<ContentDetailPage collection="stories" backTo="/stories" backLabel="К историям" />} />
        <Route path="/children" element={<CollectionPage title="Дети, которым нужна помощь" description="Актуальные опубликованные карточки помощи." collection="children" basePath="/children" emptyMessage="Активных карточек помощи сейчас нет." />} />
        <Route path="/children/:slug" element={<ContentDetailPage collection="children" backTo="/children" backLabel="К списку карточек" />} />
        <Route path="/projects/:slug" element={<ContentDetailPage collection="projects" backTo="/what-we-do" backLabel="К проектам" />} />
        <Route path="/give-help/:slug" element={<ContentDetailPage collection="helpMethods" backTo="/give-help" backLabel="К способам помощи" />} />
        <Route path="/get-help/:slug" element={<ContentDetailPage collection="getHelpDirections" backTo="/get-help" backLabel="К разделу помощи" />} />
        <Route path="/who-we/:slug" element={<ContentDetailPage collection="organizationSections" backTo="/who-we" backLabel="Об организации" />} />
        <Route path="/information" element={<CollectionPage title="Информация" description="Информационные материалы организации." collection="generalPages" basePath="/information" emptyMessage="Информационные материалы пока не опубликованы." />} />
        <Route path="/information/:slug" element={<ContentDetailPage collection="generalPages" backTo="/information" backLabel="К информационным материалам" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </main>
    <Footer />
    <SupportLink />
  </>;
}
