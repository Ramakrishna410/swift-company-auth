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

export default function MyExpenses() {
  const { user } = useAuth();
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  const { data: expenses, isLoading, error } = useQuery({
    queryKey: ['my-expenses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('owner_id', user.id)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const handleViewReceipt = (receiptUrl: string) => {
    setSelectedReceipt(receiptUrl);
    setReceiptDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Expenses</h2>
          <p className="text-muted-foreground">View and manage your expense reports</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Expense History</CardTitle>
            <CardDescription>Your submitted expense reports</CardDescription>
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
                <p className="text-lg font-semibold mb-2">No expenses found</p>
                <p className="text-sm text-muted-foreground">
                  You haven't submitted any expenses yet
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                        <TableCell>
                          {format(new Date(expense.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
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
