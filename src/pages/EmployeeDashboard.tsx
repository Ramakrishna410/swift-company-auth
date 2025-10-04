import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Receipt, TrendingUp, Clock, CheckCircle, XCircle, Scan } from 'lucide-react';

interface Expense {
  id: string;
  amount: number;
  converted_amount: number | null;
  currency: string;
  category: string | null;
  description: string;
  date: string;
  status: string;
  receipt_url: string | null;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'USD',
    category: 'Travel',
    description: '',
    date: new Date().toISOString().split('T')[0],
    receipt: null as File | null,
  });

  useEffect(() => {
    document.title = 'Employee Dashboard — Expense Manager';
  }, []);

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
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
    enabled: !!user?.id,
  });

  // Fetch company currency
  const { data: company } = useQuery({
    queryKey: ['company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('currency')
        .eq('id', profile.company_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  // Fetch my expenses - with real-time polling
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_id', user.id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!user?.id,
    refetchInterval: 20000, // Poll every 20 seconds
  });

  // Submit expense mutation
  const submitExpenseMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.id || !profile?.company_id) throw new Error('User not found');

      let converted_amount = parseFloat(data.amount);
      if (data.currency !== company?.currency) {
        // Fetch exchange rate
        try {
          const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${company?.currency}`);
          const rates = await response.json();
          converted_amount = parseFloat(data.amount) * rates.rates[data.currency];
        } catch {
          toast.error('Could not fetch exchange rate, using original amount');
        }
      }

      const { error } = await supabase.from('expenses').insert({
        owner_id: user.id,
        amount: parseFloat(data.amount),
        converted_amount,
        currency: data.currency,
        category: data.category,
        description: data.description,
        date: data.date,
        status: 'pending',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense submitted successfully!');
      setShowForm(false);
      setFormData({
        amount: '',
        currency: 'USD',
        category: 'Travel',
        description: '',
        date: new Date().toISOString().split('T')[0],
        receipt: null,
      });
    },
    onError: () => toast.error('Failed to submit expense'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitExpenseMutation.mutate(formData);
  };

  const totalSubmitted = expenses.length;
  const totalApproved = expenses.filter((e) => e.status === 'approved').length;
  const totalPending = expenses.filter((e) => e.status === 'pending').length;
  const totalRejected = expenses.filter((e) => e.status === 'rejected').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Employee Dashboard</h1>
            <p className="text-muted-foreground">Submit and track your expenses</p>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Submit Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Submit New Expense</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="INR">INR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Travel">Travel</SelectItem>
                      <SelectItem value="Food">Food</SelectItem>
                      <SelectItem value="Office">Office Supplies</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the expense..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receipt">Receipt (Optional)</Label>
                  <Input
                    id="receipt"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData({ ...formData, receipt: e.target.files?.[0] || null })}
                  />
                </div>
                <Button type="submit" className="w-full">Submit Expense</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Submitted</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSubmitted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalApproved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* My Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>My Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No expenses yet. Submit your first expense!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                      <TableCell>{expense.category || '—'}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>
                        {expense.currency} {expense.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            expense.status === 'approved'
                              ? 'default'
                              : expense.status === 'rejected'
                              ? 'destructive'
                              : 'outline'
                          }
                          className="capitalize"
                        >
                          {expense.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
