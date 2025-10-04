import { FileText, CheckSquare, Users, DollarSign, Settings, Receipt } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type UserRole = "admin" | "manager" | "employee";

const roleMenuItems = {
  employee: [
    { title: "Employee Dashboard", url: "/employee-dashboard", icon: Receipt },
    { title: "Submit Expense", url: "/submit-expense", icon: Receipt },
    { title: "My Expenses", url: "/my-expenses", icon: FileText },
  ],
  manager: [
    { title: "Manager Dashboard", url: "/manager-dashboard", icon: DollarSign },
    { title: "Submit Expense", url: "/submit-expense", icon: Receipt },
    { title: "My Expenses", url: "/my-expenses", icon: FileText },
    { title: "Pending Approvals", url: "/pending-approvals", icon: CheckSquare },
    { title: "Team Expenses", url: "/team-expenses", icon: DollarSign },
  ],
  admin: [
    { title: "Admin Dashboard", url: "/admin-dashboard", icon: Settings },
    { title: "Manage Users", url: "/manage-users", icon: Users },
    { title: "All Expenses", url: "/all-expenses", icon: FileText },
    { title: "Approval Rules", url: "/approval-rules", icon: Settings },
    { title: "Submit Expense", url: "/submit-expense", icon: Receipt },
    { title: "My Expenses", url: "/my-expenses", icon: FileText },
  ],
};

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { role } = useAuth();

  const currentPath = location.pathname;
  const items = roleMenuItems[role || 'employee'] || roleMenuItems.employee;
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Employee';

  return (
    <Sidebar collapsible="none" className="border-r bg-background">
      <SidebarContent className="bg-background">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold text-foreground px-4 py-3">
            {open && `${roleLabel} Dashboard`}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {items.map((item) => {
                const isActive = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-4 py-3 text-sm font-medium",
                            "rounded-xl transition-all duration-300",
                            "text-foreground opacity-100 visible", // Force visibility
                            isActive
                              ? "bg-primary/10 text-primary font-bold shadow-sm"
                              : "hover:bg-primary/5 hover:text-primary hover:shadow-sm"
                          )
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0 opacity-100" />
                        <span className="truncate opacity-100">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
