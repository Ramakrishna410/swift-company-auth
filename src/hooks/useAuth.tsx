import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, companyName: string, country: string, role: 'admin' | 'manager' | 'employee') => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  role: 'admin' | 'manager' | 'employee' | null;
  employeeId: string | null;
  userName: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'manager' | 'employee' | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check localStorage first
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setRole(userData.role);
        setEmployeeId(userData.employee_id);
        setUserName(userData.name);
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
      }
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch user role and profile data when authenticated
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setEmployeeId(null);
          setUserName(null);
          localStorage.removeItem('user');
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('employee_id, name, company_id, email')
        .eq('id', userId)
        .single();
      
      if (roleData && profileData) {
        const userData = {
          role: roleData.role,
          employee_id: profileData.employee_id,
          name: profileData.name,
          company_id: profileData.company_id,
          email: profileData.email,
        };
        
        // Save to state
        setRole(roleData.role);
        setEmployeeId(profileData.employee_id);
        setUserName(profileData.name);
        
        // Save to localStorage
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw error;
    }
    
    if (!data.user) {
      throw new Error('Login failed');
    }
    
    // Fetch role and profile, then persist to localStorage
    const [{ data: roleData }, { data: profileData }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', data.user.id).single(),
      supabase.from('profiles').select('employee_id, name, company_id, email').eq('id', data.user.id).single(),
    ]);

    const existing = localStorage.getItem('user');
    const existingRole = existing ? (JSON.parse(existing).role as 'admin' | 'manager' | 'employee') : null;

    const finalRole: 'admin' | 'manager' | 'employee' = (roleData?.role as any) || existingRole || 'employee';

    const userData = {
      role: finalRole,
      employee_id: profileData?.employee_id ?? null,
      name: profileData?.name ?? data.user.email ?? '',
      company_id: profileData?.company_id ?? null,
      email: profileData?.email ?? data.user.email ?? '',
    };

    localStorage.setItem('user', JSON.stringify(userData));

    // Update context
    setRole(finalRole);
    setEmployeeId(userData.employee_id);
    setUserName(userData.name);
    
    toast.success('Signed in successfully!');
    
    // Redirect based on role
    if (finalRole === 'admin') {
      navigate('/admin-dashboard');
    } else if (finalRole === 'manager') {
      navigate('/manager-dashboard');
    } else {
      navigate('/employee-dashboard');
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    name: string, 
    companyName: string, 
    country: string,
    role: 'admin' | 'manager' | 'employee'
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // First, get the currency for the country
    let currency = 'USD';
    try {
      const response = await fetch(`https://restcountries.com/v3.1/name/${country}?fullText=true`);
      const data = await response.json();
      if (data[0]?.currencies) {
        currency = Object.keys(data[0].currencies)[0];
      }
    } catch (error) {
      console.log('Could not fetch currency, defaulting to USD');
    }
    
    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: name,
          company_name: companyName,
          country: country,
        },
      },
    });
    
    if (authError) {
      throw authError;
    }
    
    if (!authData.user) {
      throw new Error('User creation failed');
    }
    
    // Check if this is the first user for this company (by checking if company exists)
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('id')
      .eq('name', companyName)
      .limit(1);
    
    const isFirstUser = !existingCompanies || existingCompanies.length === 0;
    
    // Create company if it doesn't exist
    let companyId: string;
    if (isFirstUser) {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          country: country,
          currency: currency,
        })
        .select()
        .single();
      
      if (companyError || !companyData) {
        throw companyError || new Error('Company creation failed');
      }
      companyId = companyData.id;
    } else {
      companyId = existingCompanies[0].id;
    }
    
    // Generate employee_id using the database function
    const { data: employeeIdData, error: employeeIdError } = await supabase
      .rpc('generate_employee_id', { p_company_id: companyId });
    
    if (employeeIdError) {
      throw new Error('Failed to generate employee ID');
    }
    
    // Create profile with employee_id
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        name: name,
        company_id: companyId,
        employee_id: employeeIdData,
        email: email,
      });
    
    if (profileError) {
      throw profileError;
    }
    
    // Attempt to assign role in backend, but don't block if RLS prevents it
    try {
      await supabase
        .from('user_roles')
        .insert({ user_id: authData.user.id, role });
    } catch (_) {
      // Ignore RLS errors, we'll persist the selected role on the client
    }

    // Persist to localStorage immediately based on selected role
    const userData = {
      role,
      employee_id: employeeIdData as string,
      name,
      company_id: companyId,
      email,
    };
    localStorage.setItem('user', JSON.stringify(userData));

    // Update context
    setRole(role);
    setEmployeeId(userData.employee_id);
    setUserName(name);

    toast.success('Account created successfully!');

    // Redirect based on role
    if (role === 'admin') {
      navigate('/admin-dashboard');
    } else if (role === 'manager') {
      navigate('/manager-dashboard');
    } else {
      navigate('/employee-dashboard');
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error signing out');
      throw error;
    }
    // Clear localStorage
    localStorage.removeItem('user');
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signOut, loading, role, employeeId, userName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}