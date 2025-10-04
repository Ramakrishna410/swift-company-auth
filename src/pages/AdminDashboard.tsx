import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface Profile { id: string; name: string; employee_id: string | null; email: string | null; }
interface RoleRow { user_id: string; role: 'admin' | 'manager' | 'employee'; manager_id: string | null; }
interface Company { id: string; name: string; currency: string; }
interface Expense { id: string; owner_id: string; amount: number; currency: string; status: string; date: string; }
interface Rule { id: string; name: string; rule_type: string; sequence_order: number | null; approver_role: 'admin'|'manager'|'employee'|null; is_active: boolean | null; }

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const qc = useQueryClient();

  useEffect(() => { document.title = 'Admin Dashboard — Expense Manager'; }, []);

  // Profile -> company
  const { data: profile } = useQuery({
    queryKey: ['profile-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('id, company_id').eq('id', user.id).single();
      if (error) throw error;
      return data as { id: string; company_id: string } | null;
    },
    enabled: !!user?.id,
  });

  const companyId = profile?.company_id ?? null;

  // Company info
  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase.from('companies').select('id, name, currency').eq('id', companyId).single();
      if (error) throw error;
      return data as Company;
    },
    enabled: !!companyId,
  });

  // Employees in company
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', companyId],
    queryFn: async () => {
      if (!companyId) return [] as Profile[];
      const { data, error } = await supabase.from('profiles').select('id, name, employee_id, email').eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: !!companyId,
  });

  const employeeIds = useMemo(() => employees.map(e => e.id), [employees]);

  // Roles for employees
  const { data: roles = [] } = useQuery({
    queryKey: ['roles', employeeIds.join(',')],
    queryFn: async () => {
      if (employeeIds.length === 0) return [] as RoleRow[];
      const { data, error } = await supabase.from('user_roles').select('user_id, role, manager_id').in('user_id', employeeIds);
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
    enabled: employeeIds.length > 0,
  });

  // Expenses for company (limit for analytics + table) - with real-time polling
  const monthStart = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString(); }, []);

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses-company', employeeIds.join(','), monthStart],
    queryFn: async () => {
      if (employeeIds.length === 0) return [] as Expense[];
      const { data, error } = await supabase
        .from('expenses')
        .select('id, owner_id, amount, currency, status, date')
        .in('owner_id', employeeIds)
        .gte('date', '1970-01-01')
        .order('date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    enabled: employeeIds.length > 0,
    refetchInterval: 20000, // Poll every 20 seconds
  });

  // Pending approvals for admin
  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ['admin-approvals', user?.id, employeeIds.join(',')],
    queryFn: async () => {
      if (!user?.id || employeeIds.length === 0) return [];
      const { data, error } = await supabase
        .from('approvals')
        .select('id, expense_id, decision, comment')
        .eq('approver_id', user.id)
        .eq('decision', 'pending');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && employeeIds.length > 0,
    refetchInterval: 15000, // Poll every 15 seconds
  });

  // Approval Rules
  const { data: rules = [] } = useQuery({
    queryKey: ['approval-rules', companyId],
    queryFn: async () => {
      if (!companyId) return [] as Rule[];
      const { data, error } = await supabase
        .from('approval_rules')
        .select('id, name, rule_type, sequence_order, approver_role, is_active')
        .eq('company_id', companyId)
        .order('sequence_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
    enabled: !!companyId,
  });

  // Mutations
  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin'|'manager'|'employee' }) => {
      const { error } = await supabase.rpc('set_user_role', { _user_id: userId, _role: role });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Role updated'); },
    onError: () => toast.error('Failed to update role'),
  });

  const setManagerMutation = useMutation({
    mutationFn: async ({ userId, managerId }: { userId: string; managerId: string | null }) => {
      const { error } = await supabase.from('user_roles').update({ manager_id: managerId }).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast.success('Manager assigned'); },
    onError: () => toast.error('Failed to assign manager'),
  });

  const updateRuleMutation = useMutation({
    mutationFn: async (payload: Partial<Rule> & { id: string }) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from('approval_rules').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval-rules'] }); toast.success('Rule updated'); },
    onError: () => toast.error('Failed to update rule'),
  });

  const approveExpenseMutation = useMutation({
    mutationFn: async ({ id, status, comments }: { id: string; status: 'approved'|'rejected'; comments?: string }) => {
      const { data: approval, error: approvalError } = await supabase
        .from('approvals')
        .select('expense_id')
        .eq('id', id)
        .single();
      
      if (approvalError) throw approvalError;

      const { error } = await supabase
        .from('approvals')
        .update({ decision: status, comment: comments, decided_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;

      const { error: expenseError } = await supabase
        .from('expenses')
        .update({ status })
        .eq('id', approval.expense_id);
      
      if (expenseError) throw expenseError;

      const { error: otherApprovalsError } = await supabase
        .from('approvals')
        .update({ decision: status === 'approved' ? 'approved' : 'rejected' })
        .eq('expense_id', approval.expense_id)
        .eq('decision', 'pending')
        .neq('id', id);
      
      if (otherApprovalsError) console.error('Failed to update other approvals:', otherApprovalsError);
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['admin-approvals'] });
      qc.invalidateQueries({ queryKey: ['expenses-company'] });
      toast.success('Decision saved successfully'); 
    },
    onError: () => toast.error('Failed to save decision'),
  });

  // Derived
  const roleMap = useMemo(() => Object.fromEntries(roles.map(r => [r.user_id, r.role])), [roles]);
  const managerMap = useMemo(() => Object.fromEntries(roles.map(r => [r.user_id, r.manager_id])), [roles]);

  const totalEmployees = employees.length;
  const totalExpensesThisMonth = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    return expenses.filter(e => new Date(e.date) >= start).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const spendByUser = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.owner_id] = (map[e.owner_id] || 0) + Number(e.amount || 0); });
    return map;
  }, [expenses]);

  const spendByManager = useMemo(() => {
    const map: Record<string, { manager: string; total: number }> = {};
    roles.forEach(r => {
      if (r.manager_id) {
        const spent = spendByUser[r.user_id] || 0;
        if (!map[r.manager_id]) {
          const mgr = employees.find(e => e.id === r.manager_id);
          map[r.manager_id] = { manager: mgr?.name || r.manager_id, total: 0 };
        }
        map[r.manager_id].total += spent;
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [spendByUser, roles, employees]);

  const monthlyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      const d = new Date(e.date); const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
      map[key] = (map[key] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));
  }, [expenses]);

  return (
    <DashboardLayout>
      <section className="space-y-8">
        {/* Company Summary */}
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Company-wide overview and controls</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Company</CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-medium">{company?.name ?? '—'}</div>
              <div className="text-sm text-muted-foreground">Default Currency: {company?.currency ?? '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total Employees</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalEmployees}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Expenses (This Month)</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{company?.currency ?? ''} {totalExpensesThisMonth.toFixed(2)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Top Spender</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const top = Object.entries(spendByUser).sort((a,b)=>b[1]-a[1])[0];
                if (!top) return <div className="text-sm text-muted-foreground">No data</div>;
                const p = employees.find(e => e.id === top[0]);
                return <div className="text-lg font-medium">{p?.name ?? top[0]} — {company?.currency} {top[1].toFixed(2)}</div>;
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Pending Approval Requests */}
        {pendingApprovals.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Pending Approval Requests</h2>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expense</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApprovals.map((a: any) => {
                      const expense = expenses.find(e => e.id === a.expense_id);
                      const emp = employees.find(t => t.id === expense?.owner_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell>{expense ? `${expense.currency} ${Number(expense.amount||0).toFixed(2)}` : a.expense_id}</TableCell>
                          <TableCell>{emp?.name ?? expense?.owner_id ?? '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => approveExpenseMutation.mutate({ id: a.id, status: 'approved' })}>Approve</Button>
                              <Button size="sm" variant="destructive" onClick={() => approveExpenseMutation.mutate({ id: a.id, status: 'rejected' })}>Reject</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        )}

        {/* All Employees & Managers */}
        <section>
          <h2 className="text-xl font-semibold mb-3">All Employees & Managers</h2>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Total Spent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map(emp => {
                    const empRole = (roleMap[emp.id] ?? 'employee') as 'admin'|'manager'|'employee';
                    const managerId = managerMap[emp.id] ?? null;
                    const managerName = employees.find(e => e.id === managerId)?.name ?? '—';
                    const spent = spendByUser[emp.id] ?? 0;
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>
                          <Select value={empRole} onValueChange={v => setRoleMutation.mutate({ userId: emp.id, role: v as any })}>
                            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="employee">Employee</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{emp.employee_id ?? '—'}</TableCell>
                        <TableCell>
                          <Select value={managerId ?? ''} onValueChange={v => setManagerMutation.mutate({ userId: emp.id, managerId: v || null })}>
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Unassigned</SelectItem>
                              {employees.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{company?.currency} {spent.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Expense Analytics */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Company Expenses Overview</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Monthly Totals</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTotals}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Manager Team Spending</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendByManager}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="manager" angle={-20} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>All Company Expenses</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.slice(0,50).map(e => {
                    const p = employees.find(x => x.id === e.owner_id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                        <TableCell>{p?.name ?? e.owner_id}</TableCell>
                        <TableCell><Badge className="capitalize" variant={e.status === 'approved' ? 'default' : e.status === 'rejected' ? 'destructive' : 'outline'}>{e.status}</Badge></TableCell>
                        <TableCell>{company?.currency} {Number(e.amount || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Approval Rules */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Approval Rules</h2>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Approver Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="capitalize">{r.rule_type}</TableCell>
                      <TableCell>{r.sequence_order ?? '—'}</TableCell>
                      <TableCell className="capitalize">{r.approver_role ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateRuleMutation.mutate({ id: r.id, is_active: !r.is_active })}>
                            {r.is_active ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </section>
    </DashboardLayout>
  );
}
