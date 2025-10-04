import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function AuthRedirect() {
  const navigate = useNavigate();
  const { role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (role) {
      // Redirect based on role
      if (role === 'admin') {
        navigate('/', { replace: true });
      } else if (role === 'manager') {
        navigate('/pending-approvals', { replace: true });
      } else if (role === 'employee') {
        navigate('/submit-expense', { replace: true });
      }
    }
  }, [role, loading, navigate]);

  return null;
}
