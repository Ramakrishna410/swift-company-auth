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
    <Sidebar collapsible="none">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold text-foreground">
            {open && `${roleLabel} Dashboard`}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                            "text-foreground", // Always visible text
                            isActive
                              ? "bg-accent text-accent-foreground font-semibold"
                              : "hover:bg-muted/50 hover:text-foreground"
                          )
                        }
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
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
