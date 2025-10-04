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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw error;
    }
    
    toast.success('Signed in successfully!');
    navigate('/');
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
    
    // Assign role - use selected role if first user is admin, otherwise use selected role
    const finalRole = isFirstUser && role === 'admin' ? 'admin' : role;
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: finalRole,
      });
    
    if (roleError) {
      throw roleError;
    }
    
    toast.success('Account created successfully!');
    navigate('/');
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error signing out');
      throw error;
    }
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signOut, loading }}>
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