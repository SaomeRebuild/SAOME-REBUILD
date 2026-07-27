/**
 * HomePage — landing redirect to login.
 */

import { Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

export default function HomePage() {
  return <Navigate to={ROUTES.login} replace />;
}