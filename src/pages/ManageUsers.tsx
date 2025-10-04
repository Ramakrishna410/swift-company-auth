import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, Shield, Users as UsersIcon, UserPlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";

export default function ManageUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee' as 'admin' | 'manager' | 'employee',
  });

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
        .select('id, name, email, employee_id, created_at, company_id')
        .eq('company_id', currentUserProfile.company_id)
        .order('name');
      
      if (profileError) throw profileError;
      
      // Fetch user roles for these users
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role, manager_id');
      
      if (roleError) throw roleError;
      
      // Combine the data
      return profiles.map(profile => {
        const userRole = roles.find(r => r.user_id === profile.id);
        const manager = profiles.find(p => p.id === userRole?.manager_id);
        
        return {
          ...profile,
          role: userRole?.role || 'employee',
          manager_id: userRole?.manager_id,
          manager_name: manager?.name || null,
          email: profile.email,
          employee_id: profile.employee_id,
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

  // Add new user mutation
  const addUserMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserProfile?.company_id) throw new Error('No company ID');
      
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserData.email,
        password: newUserData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      
      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');
      
      // Generate employee_id
      const { data: employeeIdData, error: employeeIdError } = await supabase
        .rpc('generate_employee_id', { p_company_id: currentUserProfile.company_id });
      
      if (employeeIdError) throw new Error('Failed to generate employee ID');
      
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          name: newUserData.name,
          email: newUserData.email,
          company_id: currentUserProfile.company_id,
          employee_id: employeeIdData,
        });
      
      if (profileError) throw profileError;
      
      // Assign role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: newUserData.role,
        });
      
      if (roleError) throw roleError;
    },
    onSuccess: () => {
      toast.success('User added successfully!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAddUserDialog(false);
      setNewUserData({ name: '', email: '', password: '', role: 'employee' });
    },
    onError: (error: any) => {
      toast.error('Failed to add user', { description: error.message });
    },
  });

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
          <div className="flex items-center gap-4">
            {users && users.length > 0 && (
              <Badge variant="outline" className="text-base px-4 py-2">
                <UsersIcon className="h-4 w-4 mr-2" />
                {users.length} users
              </Badge>
            )}
            <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>Create a new user account for your company</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-user-name">Full Name</Label>
                    <Input
                      id="new-user-name"
                      value={newUserData.name}
                      onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-email">Email</Label>
                    <Input
                      id="new-user-email"
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                      placeholder="john@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-password">Password</Label>
                    <Input
                      id="new-user-password"
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-role">Role</Label>
                    <Select
                      value={newUserData.role}
                      onValueChange={(value: 'admin' | 'manager' | 'employee') => 
                        setNewUserData({ ...newUserData, role: value })
                      }
                    >
                      <SelectTrigger id="new-user-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => addUserMutation.mutate()} 
                    className="w-full"
                    disabled={addUserMutation.isPending}
                  >
                    {addUserMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding user...
                      </>
                    ) : (
                      'Add User'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
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
                      <TableHead>Email</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right">Change Role</TableHead>
                      <TableHead className="text-right">Assign Manager</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userItem: any) => (
                      <TableRow key={userItem.id}>
                        <TableCell className="font-medium">
                          {userItem.name}
                          {userItem.employee_id && (
                            <span className="text-muted-foreground"> ({userItem.employee_id})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {userItem.email}
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
