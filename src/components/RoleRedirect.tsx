import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function RoleRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const stored = localStorage.getItem('user');
    const role = stored ? JSON.parse(stored).role : null;
    if (role === 'admin') navigate('/admin-dashboard', { replace: true });
    else if (role === 'manager') navigate('/manager-dashboard', { replace: true });
    else if (role === 'employee') navigate('/employee-dashboard', { replace: true });
    else navigate('/auth', { replace: true });
  }, [navigate]);
  return null;
}
