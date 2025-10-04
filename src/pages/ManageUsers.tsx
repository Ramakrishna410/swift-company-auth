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
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function ManageUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");

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

  // Fetch current user's company_id
  const { data: currentUserProfile } = useQuery({
    queryKey: ['currentUserProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!isAdmin,
  });

  // Fetch all users from the same company
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users', currentUserProfile?.company_id],
    queryFn: async () => {
      if (!currentUserProfile?.company_id) return [];
      
      // Fetch all profiles from the same company
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, created_at, company_id')
        .eq('company_id', currentUserProfile.company_id)
        .order('name');
      
      if (profileError) throw profileError;
      
      // Fetch user roles for these users
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role, manager_id');
      
      if (roleError) throw roleError;

      // Get auth users to fetch emails
      const userIds = profiles.map(p => p.id);
      let authUsers: any[] = [];
      
      // Note: admin.listUsers() requires service role, so we'll skip email for now
      // or handle it differently based on your RLS policies
      
      // Combine the data
      return profiles.map(profile => {
        const userRole = roles.find(r => r.user_id === profile.id);
        const manager = profiles.find(p => p.id === userRole?.manager_id);
        
        return {
          ...profile,
          role: userRole?.role || 'employee',
          manager_id: userRole?.manager_id,
          manager_name: manager?.name || null,
        };
      });
    },
    enabled: !!isAdmin && !!currentUserProfile?.company_id,
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as 'employee' | 'manager' | 'admin' })
        .eq('user_id', userId);

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

  // Mutation to assign manager
  const assignManagerMutation = useMutation({
    mutationFn: async ({ userId, managerId }: { userId: string; managerId: string | null }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ manager_id: managerId })
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Manager assigned successfully');
      setSelectedUserId(null);
      setSelectedManagerId("");
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign manager');
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, newRole });
  };

  const handleAssignManager = () => {
    if (!selectedUserId) return;
    assignManagerMutation.mutate({ 
      userId: selectedUserId, 
      managerId: selectedManagerId || null 
    });
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

  // Get potential managers (admins and managers, excluding the selected user)
  const potentialManagers = users?.filter(u => 
    (u.role === 'admin' || u.role === 'manager') && 
    u.id !== selectedUserId
  ) || [];

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
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right">Change Role</TableHead>
                      <TableHead className="text-right">Assign Manager</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userItem: any) => (
                      <TableRow key={userItem.id}>
                        <TableCell className="font-medium">{userItem.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {userItem.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleColor(userItem.role)} className="capitalize">
                            {userItem.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {userItem.manager_name || <span className="text-muted-foreground">None</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={userItem.role}
                            onValueChange={(newRole) => handleRoleChange(userItem.id, newRole)}
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
                        <TableCell className="text-right">
                          <Dialog 
                            open={selectedUserId === userItem.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setSelectedUserId(userItem.id);
                                setSelectedManagerId(userItem.manager_id || "");
                              } else {
                                setSelectedUserId(null);
                                setSelectedManagerId("");
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Assign Manager
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Assign Manager</DialogTitle>
                                <DialogDescription>
                                  Select a manager for {userItem.name}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="manager">Manager</Label>
                                  <Select
                                    value={selectedManagerId}
                                    onValueChange={setSelectedManagerId}
                                  >
                                    <SelectTrigger id="manager">
                                      <SelectValue placeholder="Select a manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="">No Manager</SelectItem>
                                      {potentialManagers.map((manager) => (
                                        <SelectItem key={manager.id} value={manager.id}>
                                          {manager.name} ({manager.role})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button onClick={handleAssignManager} className="w-full">
                                  Assign Manager
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
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
