import { createBrowserRouter, Navigate, Link, useLocation } from 'react-router';
import { Layout } from './components/layout';
import { Landing } from './pages/landing';
import { Portfolio } from './pages/portfolio';
import { Gallery } from './pages/gallery';
import { Store } from './pages/store';
import { ProductDetail } from './pages/product-detail';
import { Cart } from './pages/cart';
import { Checkout } from './pages/checkout';
import { Orders } from './pages/orders';
import { Admin } from './pages/admin';
import { Login } from './pages/login';
import { Register } from './pages/register';
import { Profile } from './pages/profile';
import { VerifyEmail } from './pages/verify-email';
import { Contact } from './pages/contact';
import { Tickets } from './pages/tickets';
import { TicketDetail } from './pages/ticket-detail';
import { ForgotPassword } from './pages/forgot-password';
import { ResetPassword } from './pages/reset-password';
import { CourseCatalog } from './pages/courses/catalog';
import { CourseBuilder } from './pages/courses/course-builder';
import { CourseDetail } from './pages/courses/course-detail';
import { CoursePlayer } from './pages/courses/course-player';
import { MyLearning } from './pages/courses/my-learning';
import { CertificatePage } from './pages/courses/certificate';
import { Docs } from './pages/docs';
import { Blog } from './pages/blog';
import { BlogPost } from './pages/blog-post';
import { Forms } from './pages/forms';
import { FormPage } from './pages/form-page';
import { Team } from './pages/team';
import { TeamMember } from './pages/team-member';
import { BusinessDetail } from './pages/business-detail';
import { ProjectDetail } from './pages/project-detail';
import { Resume } from './pages/resume';
import { useAuthStore } from './store/authStore';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  // Allow full admins AND staff users who have at least one permission
  const isStaff = user?.is_admin || (user?.permissions && user.permissions.length > 0);
  if (!isStaff) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="min-h-screen pt-24 pb-20 px-4 flex flex-col items-center justify-center text-center">
      <p className="text-8xl font-bold text-primary/20 mb-4">404</p>
      <h1 className="text-3xl mb-3">Page not found</h1>
      <p className="text-black/50 mb-8">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm text-white hover:bg-primary/90 transition-colors">
        Back to Home
      </Link>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Landing },
      { path: 'portfolio', Component: Portfolio },
      { path: 'gallery', Component: Gallery },
      { path: 'store', Component: Store },
      { path: 'store/product/:id', Component: ProductDetail },
      { path: 'store/cart', Component: Cart },
      {
        path: 'store/checkout',
        element: <RequireAuth><Checkout /></RequireAuth>,
      },
      {
        path: 'store/orders',
        element: <RequireAuth><Orders /></RequireAuth>,
      },
      {
        path: 'admin',
        element: <RequireAdmin><Admin /></RequireAdmin>,
      },
      {
        path: 'admin/courses/:courseId/builder',
        element: <RequireAdmin><CourseBuilder /></RequireAdmin>,
      },
      { path: 'login', Component: Login },
      { path: 'register', Component: Register },
      {
        path: 'profile',
        element: <RequireAuth><Profile /></RequireAuth>,
      },
      { path: 'verify-email', Component: VerifyEmail },
      { path: 'contact', Component: Contact },
      { path: 'forgot-password', Component: ForgotPassword },
      { path: 'reset-password', Component: ResetPassword },
      {
        path: 'tickets',
        element: <RequireAuth><Tickets /></RequireAuth>,
      },
      {
        path: 'tickets/:id',
        element: <RequireAuth><TicketDetail /></RequireAuth>,
      },
      // Team
      { path: 'team', Component: Team },
      { path: 'team/:slug', Component: TeamMember },
      // Businesses / Projects — pitch-deck detail pages
      { path: 'businesses/:id', Component: BusinessDetail },
      { path: 'portfolio/project/:id', Component: ProjectDetail },
      // Blog
      { path: 'blog', Component: Blog },
      { path: 'blog/:slug', Component: BlogPost },
      // Forms
      { path: 'forms', Component: Forms },
      { path: 'forms/:slug', Component: FormPage },
      // Courses — public
      { path: 'courses', Component: CourseCatalog },
      { path: 'courses/certificate/:certNumber', Component: CertificatePage },
      { path: 'docs', Component: Docs },
      { path: 'courses/:courseId', Component: CourseDetail },
      // Courses — auth required
      {
        path: 'courses/my-learning',
        element: <RequireAuth><MyLearning /></RequireAuth>,
      },
      // 404
      { path: '*', Component: NotFound },
    ],
  },
  // Resume — standalone (no navbar) so print output is clean
  { path: '/resume', Component: Resume },
  // Course player is full-screen (no navbar/footer) — auth required
  {
    path: '/courses/:courseId/learn',
    element: <RequireAuth><CoursePlayer /></RequireAuth>,
  },
  {
    path: '/courses/:courseId/learn/:lessonId',
    element: <RequireAuth><CoursePlayer /></RequireAuth>,
  },
]);
