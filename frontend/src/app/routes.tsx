import { createBrowserRouter, Navigate, Link, useLocation } from 'react-router';
import { lazy, Suspense } from 'react';
import { Layout } from './components/layout';
import { Landing } from './pages/landing';
import { Portfolio } from './pages/portfolio';
import { Gallery } from './pages/gallery';
import { Store } from './pages/store';
import { ProductDetail } from './pages/product-detail';
import { Cart } from './pages/cart';
import { Checkout } from './pages/checkout';
import { Orders } from './pages/orders';
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
import { Docs } from './pages/docs';
import { Blog } from './pages/blog';
import { BlogPost } from './pages/blog-post';
import { Forms } from './pages/forms';
import { FormPage } from './pages/form-page';
import { Team } from './pages/team';
import { TeamMember } from './pages/team-member';
import { BusinessDetail } from './pages/business-detail';
import { ProjectDetail } from './pages/project-detail';
import { Projects } from './pages/projects';
import { ProjectOrgDetail } from './pages/project-org-detail';
import { Resume } from './pages/resume';
import { useAuthStore } from './store/authStore';

const Admin=lazy(()=>import('./pages/admin').then((module)=>({default:module.Admin})));
const CourseBuilder=lazy(()=>import('./pages/courses/course-builder').then((module)=>({default:module.CourseBuilder})));
const CourseDetail=lazy(()=>import('./pages/courses/course-detail').then((module)=>({default:module.CourseDetail})));
const CoursePlayer=lazy(()=>import('./pages/courses/course-player').then((module)=>({default:module.CoursePlayer})));
const MyLearning=lazy(()=>import('./pages/courses/my-learning').then((module)=>({default:module.MyLearning})));
const CertificatePage=lazy(()=>import('./pages/courses/certificate').then((module)=>({default:module.CertificatePage})));

function Deferred({children}:{children:React.ReactNode}){
  return <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-black/50">Loading…</div>}>{children}</Suspense>;
}

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
        element: <RequireAdmin><Deferred><Admin /></Deferred></RequireAdmin>,
      },
      {
        path: 'admin/courses/:courseId/builder',
        element: <RequireAdmin><Deferred><CourseBuilder /></Deferred></RequireAdmin>,
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
      // Organizational projects (company-wide, contributed by any team member)
      { path: 'projects', Component: Projects },
      { path: 'projects/:id', Component: ProjectOrgDetail },
      // Blog
      { path: 'blog', Component: Blog },
      { path: 'blog/:slug', Component: BlogPost },
      // Forms
      { path: 'forms', Component: Forms },
      { path: 'forms/:slug', Component: FormPage },
      // Courses — public
      { path: 'courses', Component: CourseCatalog },
      { path: 'courses/certificate/:certNumber', element: <Deferred><CertificatePage /></Deferred> },
      { path: 'docs', Component: Docs },
      { path: 'courses/:courseId', element: <Deferred><CourseDetail /></Deferred> },
      // Courses — auth required
      {
        path: 'courses/my-learning',
        element: <RequireAuth><Deferred><MyLearning /></Deferred></RequireAuth>,
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
    element: <RequireAuth><Deferred><CoursePlayer /></Deferred></RequireAuth>,
  },
  {
    path: '/courses/:courseId/learn/:lessonId',
    element: <RequireAuth><Deferred><CoursePlayer /></Deferred></RequireAuth>,
  },
]);
