import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, employeeId, userName, role } = useAuth();

  // Fetch user profile (kept for company_id)
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('company_id')
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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger className="-ml-2" />
            {company && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                  {company.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-lg font-semibold">{company.name}</h1>
                  <p className="text-xs text-muted-foreground">
                    Default Currency: {company.currency}
                  </p>
                </div>
              </div>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">
                  {userName || user?.email}
                  {employeeId && <span className="text-muted-foreground"> ({employeeId})</span>}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{role || 'employee'}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                title="Logout"
                aria-label="Logout"
                className="hover:bg-destructive/10 hover:text-destructive"
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
