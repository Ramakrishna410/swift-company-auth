import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile { id: string; name: string; employee_id: string | null; }
interface RoleRow { user_id: string; manager_id: string | null; }
interface Expense { id: string; owner_id: string; amount: number; currency: string; status: string; date: string; description: string; }
interface Approval { id: string; expense_id: string; decision: string; comment: string | null; }

export default function ManagerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all'|'pending'|'approved'|'rejected'>('all');
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; id: string | null; action: 'approve'|'reject' }>(() => ({ open: false, id: null, action: 'approve' }));
  const [approvalComment, setApprovalComment] = useState('');

  useEffect(() => { document.title = 'Manager Dashboard — Expense Manager'; }, []);

  // Profile -> company
  const { data: profile } = useQuery({
    queryKey: ['profile-manager', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from('profiles').select('id, company_id').eq('id', user.id).single();
      if (error) throw error;
      return data as { id: string; company_id: string } | null;
    },
    enabled: !!user?.id,
  });
  const companyId = profile?.company_id ?? null;

  // Team members (by manager_id within same company)
  const { data: teamRoles = [] } = useQuery({
    queryKey: ['team-roles', user?.id, companyId],
    queryFn: async () => {
      if (!user?.id || !companyId) return [] as RoleRow[];
      
      // Get all employees in the same company
      const { data: companyProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId);
      
      if (profileError) throw profileError;
      const companyUserIds = companyProfiles?.map(p => p.id) || [];
      
      // Get team roles filtered by manager and company
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, manager_id')
        .eq('manager_id', user.id)
        .in('user_id', companyUserIds);
      
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
    enabled: !!user?.id && !!companyId,
  });

  const teamIds = useMemo(() => teamRoles.map(r => r.user_id), [teamRoles]);

  const { data: team = [] } = useQuery({
    queryKey: ['team-profiles', teamIds.join(','), companyId],
    queryFn: async () => {
      if (teamIds.length === 0 || !companyId) return [] as Profile[];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, employee_id')
        .in('id', teamIds)
        .eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: teamIds.length > 0 && !!companyId,
  });

  // Team expenses
  const { data: teamExpenses = [] } = useQuery({
    queryKey: ['team-expenses', teamIds.join(','), statusFilter],
    queryFn: async () => {
      if (teamIds.length === 0) return [] as Expense[];
      let q = supabase.from('expenses').select('id, owner_id, amount, currency, status, date, description').in('owner_id', teamIds).order('date', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    enabled: teamIds.length > 0,
  });

  // Pending approvals assigned to current manager
  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ['manager-approvals', user?.id, teamIds.join(',')],
    queryFn: async () => {
      if (!user?.id || teamIds.length === 0) return [] as Approval[];
      const { data, error } = await supabase
        .from('approvals')
        .select('id, expense_id, decision, comment')
        .eq('approver_id', user.id)
        .eq('decision', 'pending');
      if (error) throw error;
      return (data ?? []) as Approval[];
    },
    enabled: !!user?.id && teamIds.length > 0,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status, comments }: { id: string; status: 'approved'|'rejected'; comments?: string }) => {
      const { error } = await supabase.from('approvals').update({ decision: status, comment: comments, decided_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['manager-approvals'] }); toast.success('Decision saved'); setApproveDialog({ open: false, id: null, action: 'approve' }); setApprovalComment(''); },
    onError: () => toast.error('Failed to save decision'),
  });

  // Summaries
  const teamExpenseSummary = useMemo(() => {
    const map: Record<string, number> = {};
    teamExpenses.forEach(e => { map[e.owner_id] = (map[e.owner_id] || 0) + Number(e.amount || 0); });
    return map;
  }, [teamExpenses]);

  const pendingApprovalsByEmployee = useMemo(() => {
    const expenseMap = new Map<string, string>(); // expense_id -> owner_id
    teamExpenses.forEach(e => expenseMap.set(e.id, e.owner_id));
    const counts: Record<string, number> = {};
    pendingApprovals.forEach(a => {
      const owner = expenseMap.get(a.expense_id);
      if (owner) counts[owner] = (counts[owner] || 0) + 1;
    });
    return counts;
  }, [pendingApprovals, teamExpenses]);

  return (
    <DashboardLayout>
      <section className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Manager Dashboard</h1>
          <p className="text-muted-foreground">Overview of your team</p>
        </div>

        {/* Team Overview */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Team Overview</h2>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Total Spend</TableHead>
                    <TableHead>Pending Approvals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.employee_id ?? '—'}</TableCell>
                      <TableCell>${(teamExpenseSummary[emp.id] || 0).toFixed(2)}</TableCell>
                      <TableCell>{pendingApprovalsByEmployee[emp.id] || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Expense Tracker */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Expense Tracker</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamExpenses.map(e => {
                    const emp = team.find(t => t.id === e.owner_id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                        <TableCell>{emp?.name ?? e.owner_id}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell>
                          <Badge className="capitalize" variant={e.status === 'approved' ? 'default' : e.status === 'rejected' ? 'destructive' : 'outline'}>{e.status}</Badge>
                        </TableCell>
                        <TableCell>{e.currency} {Number(e.amount || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Approvals Panel */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Approvals Panel</h2>
          <Card>
            <CardContent className="pt-6">
              {pendingApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending approvals.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expense</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApprovals.map(a => {
                      const expense = teamExpenses.find(e => e.id === a.expense_id);
                      const emp = team.find(t => t.id === expense?.owner_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell>{expense ? `${expense.description} — ${expense.currency} ${Number(expense.amount||0).toFixed(2)}` : a.expense_id}</TableCell>
                          <TableCell>{emp?.name ?? expense?.owner_id ?? '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => setApproveDialog({ open: true, id: a.id, action: 'approve' })}>Approve</Button>
                              <Button size="sm" variant="destructive" onClick={() => setApproveDialog({ open: true, id: a.id, action: 'reject' })}>Reject</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        <Dialog open={approveDialog.open} onOpenChange={(o)=> setApproveDialog(s => ({ ...s, open: o }))}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{approveDialog.action === 'approve' ? 'Approve' : 'Reject'} Approval</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea placeholder="Add an optional comment" value={approvalComment} onChange={(e)=> setApprovalComment(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={()=> setApproveDialog({ open: false, id: null, action: 'approve' })}>Cancel</Button>
                <Button onClick={()=> approveDialog.id && approveMutation.mutate({ id: approveDialog.id, status: approveDialog.action === 'approve' ? 'approved' : 'rejected', comments: approvalComment })}>
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </DashboardLayout>
  );
}
