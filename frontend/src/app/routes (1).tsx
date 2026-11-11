import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import { Layout } from './components/layout';
import { Landing } from './pages/landing';
import { Portfolio } from './pages/portfolio';
import { Gallery } from './pages/gallery';
import { Store } from './pages/store';
import { ProductDetail } from './pages/product-detail';
import { Cart } from './pages/cart';
import { Checkout } from './pages/checkout';
import { Admin } from './pages/admin';
import { Login } from './pages/login';
import { Register } from './pages/register';
import { Profile } from './pages/profile';
import { VerifyEmail } from './pages/verify-email';
import { CourseCatalog } from './pages/courses/catalog';
import { CourseDetail } from './pages/courses/course-detail';
import { CoursePlayer } from './pages/courses/course-player';
import { MyLearning } from './pages/courses/my-learning';
import { CertificatePage } from './pages/courses/certificate';
import { useAuthStore } from './store/authStore';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <>{children}</>;
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
      { path: 'store/checkout', Component: Checkout },
      { path: 'admin', Component: Admin },
      { path: 'admin/courses/:courseId/builder', Component: Admin },
      { path: 'login', Component: Login },
      { path: 'register', Component: Register },
      { path: 'profile', Component: Profile },
      { path: 'verify-email', Component: VerifyEmail },
      // Courses — public
      { path: 'courses', Component: CourseCatalog },
      { path: 'courses/certificate/:certNumber', Component: CertificatePage },
      { path: 'courses/:courseId', Component: CourseDetail },
      // Courses — auth required
      {
        path: 'courses/my-learning',
        element: <RequireAuth><MyLearning /></RequireAuth>,
      },
    ],
  },
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
