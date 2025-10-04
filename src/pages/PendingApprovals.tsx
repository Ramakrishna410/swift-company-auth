import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStatusBadgeVariant, getStatusColor } from "@/lib/expenseUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function PendingApprovals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [comments, setComments] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  // Fetch approvals assigned to current user
  const { data: expenses, isLoading, error } = useQuery({
    queryKey: ["pending-approvals", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get approval records where user is the approver
      const { data: approvalRecords, error: approvalsError } = await supabase
        .from('approval_records')
        .select('*, expenses(*)')
        .eq('approver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (approvalsError) throw approvalsError;
      
      if (!approvalRecords || approvalRecords.length === 0) return [];

      // Get employee names
      const ownerIds = [...new Set(approvalRecords.map(r => r.expenses.owner_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ownerIds);

      const profileMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);

      // Check if previous approvals in sequence are complete
      const enrichedRecords = await Promise.all(
        approvalRecords.map(async (record) => {
          // Check if all previous approvals are completed
          const { data: previousApprovals } = await supabase
            .from('approval_records')
            .select('status')
            .eq('expense_id', record.expense_id)
            .lt('sequence_order', record.sequence_order);
          
          const allPreviousApproved = previousApprovals?.every(a => a.status === 'approved') ?? true;
          
          return {
            ...record,
            expense: record.expenses,
            employee: profileMap.get(record.expenses.owner_id) || 'Unknown',
            canApprove: allPreviousApproved,
          };
        })
      );

      return enrichedRecords;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Approve/Reject mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ 
      recordId, 
      expenseId, 
      action, 
      comments 
    }: { 
      recordId: string; 
      expenseId: string; 
      action: "approve" | "reject";
      comments: string;
    }) => {
      // Update approval record
      const { error: updateError } = await supabase
        .from('approval_records')
        .update({ 
          status: action === "approve" ? "approved" : "rejected",
          comments: comments,
          approved_at: new Date().toISOString(),
        })
        .eq('id', recordId);

      if (updateError) throw updateError;

      if (action === "reject") {
        // If rejected, mark entire expense as rejected
        const { error: expenseError } = await supabase
          .from('expenses')
          .update({ status: 'rejected' })
          .eq('id', expenseId);
        
        if (expenseError) throw expenseError;
      } else {
        // If approved, check if this is the last approval
        const { data: allApprovals } = await supabase
          .from('approval_records')
          .select('status')
          .eq('expense_id', expenseId);
        
        const allApproved = allApprovals?.every(a => a.status === 'approved');
        
        if (allApproved) {
          // All approvals complete, mark expense as approved
          const { error: expenseError } = await supabase
            .from('expenses')
            .update({ status: 'approved' })
            .eq('id', expenseId);
          
          if (expenseError) throw expenseError;
        }
      }
    },
    onSuccess: (data, variables) => {
      const action = variables.action;
      toast.success(
        `Expense ${action === "approve" ? "approved" : "rejected"} successfully!`
      );
      queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
      setProcessingId(null);
      setDialogOpen(false);
      setComments("");
      setSelectedExpense(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast.error("Failed to process expense", {
        description: error.message,
      });
      setProcessingId(null);
    },
  });

  const openApprovalDialog = (record: any, action: "approve" | "reject") => {
    setSelectedExpense(record);
    setActionType(action);
    setDialogOpen(true);
  };

  const handleConfirmAction = () => {
    if (!selectedExpense || !actionType) return;
    
    setProcessingId(selectedExpense.id);
    approvalMutation.mutate({
      recordId: selectedExpense.id,
      expenseId: selectedExpense.expense_id,
      action: actionType,
      comments: comments,
    });
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
                      <TableHead>Original</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Sequence</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.employee}</TableCell>
                        <TableCell>
                          {record.expense.currency} {Number(record.expense.amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {record.expense.original_currency !== record.expense.currency && (
                            <span>
                              {record.expense.original_currency} {Number(record.expense.original_amount).toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.expense.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {record.expense.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            Step {record.sequence_order}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.canApprove ? (
                            <Badge 
                              variant={getStatusBadgeVariant('pending')}
                              className={getStatusColor('pending')}
                            >
                              Ready
                            </Badge>
                          ) : (
                            <Badge variant="outline">Waiting</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => openApprovalDialog(record, "approve")}
                              disabled={!record.canApprove || processingId === record.id}
                            >
                              {processingId === record.id ? (
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
                              onClick={() => openApprovalDialog(record, "reject")}
                              disabled={!record.canApprove || processingId === record.id}
                            >
                              {processingId === record.id ? (
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

      {/* Approval/Rejection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve" : "Reject"} Expense
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" 
                ? "Add optional comments for this approval."
                : "Please provide a reason for rejecting this expense."}
            </DialogDescription>
          </DialogHeader>
          
          {selectedExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Employee:</div>
                <div className="font-medium">{selectedExpense.employee}</div>
                
                <div className="text-muted-foreground">Amount:</div>
                <div className="font-medium">
                  {selectedExpense.expense.currency} {Number(selectedExpense.expense.amount).toFixed(2)}
                </div>
                
                <div className="text-muted-foreground">Description:</div>
                <div className="font-medium line-clamp-2">{selectedExpense.expense.description}</div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="comments">Comments {actionType === "reject" && "*"}</Label>
                <Textarea
                  id="comments"
                  placeholder={actionType === "approve" ? "Optional comments..." : "Reason for rejection..."}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setComments("");
                setSelectedExpense(null);
                setActionType(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleConfirmAction}
              disabled={actionType === "reject" && !comments.trim()}
            >
              {actionType === "approve" ? "Approve" : "Reject"} Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}