import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function RoleRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth', { replace: true });
        return;
      }
      const userId = session.user.id;

      const [roleRes, companyRes, profileRes] = await Promise.all([
        supabase.rpc('get_user_role', { _user_id: userId }),
        supabase.rpc('get_user_company_id', { _user_id: userId }),
        supabase.from('profiles').select('employee_id, name, email').eq('id', userId).maybeSingle(),
      ]);

      const role = (roleRes.data as 'admin' | 'manager' | 'employee' | null) || (session.user.user_metadata?.role as any) || 'employee';
      const company_id = companyRes.data || null;
      const profile = profileRes.data || null;

      const userData = {
        role,
        employee_id: profile?.employee_id ?? null,
        name: profile?.name ?? session.user.email ?? '',
        company_id,
        email: profile?.email ?? session.user.email ?? '',
      };
      localStorage.setItem('user', JSON.stringify(userData));

      if (role === 'admin') navigate('/admin-dashboard', { replace: true });
      else if (role === 'manager') navigate('/manager-dashboard', { replace: true });
      else navigate('/employee-dashboard', { replace: true });
    })();
  }, [navigate]);
  return null;
}
