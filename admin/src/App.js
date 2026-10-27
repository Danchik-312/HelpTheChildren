import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import AreaRoute from './auth/AreaRoute';
import AdminLayout from './layout/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import MediaPage from './pages/MediaPage';
import PublicationFormPage from './pages/PublicationFormPage';
import PublicationPreviewPage from './pages/PublicationPreviewPage';
import PublicationsPage from './pages/PublicationsPage';
import SectionPlaceholder from './pages/SectionPlaceholder';
import ContentListPage from './pages/ContentListPage';
import ContentFormPage from './pages/ContentFormPage';
import ContentPreviewPage from './pages/ContentPreviewPage';
import HeroPage from './pages/HeroPage';
import ContactsPage from './pages/ContactsPage';
import OrganizationPage from './pages/OrganizationPage';
import HomepageBlocksPage from './pages/HomepageBlocksPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AuditLogPage from './pages/AuditLogPage';
import CategoriesPage from './pages/CategoriesPage';

const section = title => <SectionPlaceholder title={title} />;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route element={<AreaRoute area="PUBLICATIONS" />}>
            <Route path="publications" element={<PublicationsPage />} />
            <Route path="publications/new" element={<PublicationFormPage />} />
            <Route path="publications/:id/edit" element={<PublicationFormPage />} />
            <Route path="publications/:id/preview" element={<PublicationPreviewPage />} />
          </Route>
          <Route element={<AreaRoute adminOnly />}><Route path="categories" element={<CategoriesPage />} /></Route>
          {['stories', 'children', 'projects', 'pages'].map(resource => {
            const area = resource.toUpperCase();
            return <Route key={resource} element={<AreaRoute area={area} />}><Route path={resource} element={<ContentListPage resource={resource} />} /><Route path={`${resource}/new`} element={<ContentFormPage resource={resource} />} /><Route path={`${resource}/:id/edit`} element={<ContentFormPage resource={resource} />} /><Route path={`${resource}/:id/preview`} element={<ContentPreviewPage resource={resource} />} /></Route>;
          })}
          <Route element={<AreaRoute area="MEDIA" />}><Route path="media" element={<MediaPage />} /></Route>
          <Route element={<AreaRoute area="HERO" />}><Route path="hero" element={<HeroPage />} /></Route>
          <Route element={<AreaRoute area="SITE" />}>
            <Route path="settings/contacts" element={<ContactsPage />} />
            <Route path="settings/organization" element={<OrganizationPage />} />
            <Route path="settings/home" element={<HomepageBlocksPage />} />
          </Route>
          <Route element={<AreaRoute adminOnly />}>
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
