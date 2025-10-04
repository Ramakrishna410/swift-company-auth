import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, Shield, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function ManageUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check if user is admin
  const { data: isAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ['isAdmin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Redirect if not admin
  useEffect(() => {
    if (!checkingRole && !isAdmin) {
      toast.error("Access Denied", {
        description: "Only Admins can access this page",
      });
      navigate("/");
    }
  }, [isAdmin, checkingRole, navigate]);

  // Fetch all users with roles
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');

      if (profilesError) throw profilesError;

      // Get roles for all users
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

      return profilesData?.map(profile => ({
        ...profile,
        role: rolesMap.get(profile.id) || 'employee'
      })) || [];
    },
    enabled: !!isAdmin,
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      // Delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert([{
          user_id: userId,
          role: newRole as 'employee' | 'manager' | 'admin',
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('User role updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast.error('Failed to update user role', {
        description: error.message,
      });
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, newRole });
  };

  const getRoleColor = (role: string): "default" | "secondary" | "destructive" => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'manager':
        return 'default';
      default:
        return 'secondary';
    }
  };

  if (checkingRole || (!isAdmin && !checkingRole)) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Manage Users
            </h2>
            <p className="text-muted-foreground">Add, edit, and manage user accounts</p>
          </div>
          {users && users.length > 0 && (
            <Badge variant="outline" className="text-base px-4 py-2">
              <UsersIcon className="h-4 w-4 mr-2" />
              {users.length} users
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View and modify user roles and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading users...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-lg font-semibold mb-2">Failed to load users</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {error instanceof Error ? error.message : "Unknown error occurred"}
                </p>
                <Button
                  variant="outline"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
                >
                  Retry
                </Button>
              </div>
            ) : !users || users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UsersIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-semibold mb-2">No users found</p>
                <p className="text-sm text-muted-foreground">
                  No users registered in the system
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead className="text-right">Change Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.id}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleColor(user.role)} className="capitalize">
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={user.role}
                            onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-[140px] ml-auto">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="employee">Employee</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info removed - now using Lovable Cloud */}
      </div>
    </DashboardLayout>
  );
}
