import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  // Fetch user profile and role
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('name, company_id')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch company currency
  const { data: company } = useQuery({
    queryKey: ['company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data } = await supabase
        .from('companies')
        .select('name, currency')
        .eq('id', profile.company_id)
        .single();
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const { data: userRole } = useQuery({
    queryKey: ['userRole', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .order('role')
        .limit(1)
        .single();
      return data?.role || 'employee';
    },
    enabled: !!user?.id,
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger className="-ml-2" />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">Expense Management System</h1>
              {company && (
                <p className="text-xs text-muted-foreground">
                  {company.name} • Default Currency: {company.currency}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{profile?.name || user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole || 'employee'}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
