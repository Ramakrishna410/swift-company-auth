import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Loader2, AlertCircle, Eye, FileText } from "lucide-react";
import { getStatusBadgeVariant, getStatusColor } from "@/lib/expenseUtils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function TeamExpenses() {
  const { user } = useAuth();
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  // Fetch user's company
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

  // Fetch team expenses
  const { data: expenses, isLoading, error } = useQuery({
    queryKey: ['team-expenses', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      
      // Get all users in the same company
      const { data: companyProfiles } = await supabase
        .from('profiles')
        .select('id, name, employee_id')
        .eq('company_id', profile.company_id);
      
      if (!companyProfiles) return [];
      
      const userIds = companyProfiles.map(p => p.id);
      const profileMap = new Map(companyProfiles.map(p => [p.id, { name: p.name, employee_id: p.employee_id }]));
      
      // Fetch expenses for all company users
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .in('owner_id', userIds)
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(expense => {
        const profile = profileMap.get(expense.owner_id) || { name: 'Unknown', employee_id: null };
        return {
          ...expense,
          employee_name: profile.name,
          employee_id: profile.employee_id,
        };
      });
    },
    enabled: !!profile?.company_id,
  });

  const handleViewReceipt = (receiptUrl: string) => {
    setSelectedReceipt(receiptUrl);
    setReceiptDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Team Expenses</h2>
          <p className="text-muted-foreground">View all expenses from your team</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Team Expense Reports</CardTitle>
            <CardDescription>Overview of all team member expenses</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading expenses...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-lg font-semibold mb-2">Failed to load expenses</p>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Unknown error occurred"}
                </p>
              </div>
            ) : !expenses || expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-semibold mb-2">No team expenses</p>
                <p className="text-sm text-muted-foreground">
                  No expenses have been submitted yet
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense: any) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">
                          {expense.employee_name}
                          {expense.employee_id && (
                            <span className="text-muted-foreground"> ({expense.employee_id})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(expense.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          {expense.currency} {Number(expense.amount).toFixed(2)}
                          {expense.original_currency && expense.original_currency !== expense.currency && (
                            <span className="text-xs text-muted-foreground block">
                              ({expense.original_currency} {Number(expense.original_amount).toFixed(2)})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {expense.description}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={getStatusBadgeVariant(expense.status)}
                            className={getStatusColor(expense.status)}
                          >
                            {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {expense.receipt_url ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewReceipt(expense.receipt_url)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">No receipt</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receipt Preview Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <div className="flex items-center justify-center overflow-auto">
              <img 
                src={selectedReceipt} 
                alt="Receipt" 
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}