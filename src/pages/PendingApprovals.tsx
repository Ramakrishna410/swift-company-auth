import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function PendingApprovals() {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch pending approvals with employee names
  const { data: expenses, isLoading, error } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (expensesError) throw expensesError;

      // Fetch profile names for each expense
      const ownerIds = [...new Set(expensesData?.map(e => e.owner_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ownerIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

      return expensesData?.map(expense => ({
        ...expense,
        employee: profileMap.get(expense.owner_id) || 'Unknown'
      })) || [];
    },
    refetchInterval: 30000,
  });

  // Approve/Reject mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ expenseId, action }: { expenseId: string; action: "approve" | "reject" }) => {
      const { error } = await supabase
        .from('expenses')
        .update({ status: action === "approve" ? "approved" : "rejected" })
        .eq('id', expenseId);

      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      const action = variables.action;
      toast.success(
        `Expense ${action === "approve" ? "approved" : "rejected"} successfully!`
      );
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      setProcessingId(null);
    },
    onError: (error: any) => {
      toast.error("Failed to process expense", {
        description: error.message,
      });
      setProcessingId(null);
    },
  });

  const handleApprove = (expenseId: string) => {
    setProcessingId(expenseId);
    approvalMutation.mutate({ expenseId, action: "approve" });
  };

  const handleReject = (expenseId: string) => {
    setProcessingId(expenseId);
    approvalMutation.mutate({ expenseId, action: "reject" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pending Approvals</h2>
          <p className="text-muted-foreground">Review and approve expense reports</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Expenses Awaiting Approval</CardTitle>
            <CardDescription>
              Review submitted expenses from your team
              {expenses && expenses.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {expenses.length} pending
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading approvals...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-lg font-semibold mb-2">Failed to load approvals</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {error instanceof Error ? error.message : "Unknown error occurred"}
                </p>
                <Button
                  variant="outline"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["pending-approvals"] })}
                >
                  Retry
                </Button>
              </div>
            ) : !expenses || expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-semibold mb-2">No pending approvals</p>
                <p className="text-sm text-muted-foreground">
                  All expenses have been reviewed
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense: any) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.employee}</TableCell>
                        <TableCell>
                          {expense.currency} {Number(expense.amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(expense.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {expense.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(expense.id)}
                              disabled={processingId === expense.id}
                            >
                              {processingId === expense.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(expense.id)}
                              disabled={processingId === expense.id}
                            >
                              {processingId === expense.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </>
                              )}
                            </Button>
                          </div>
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
    </DashboardLayout>
  );
}