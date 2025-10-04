import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, Eye } from "lucide-react";

interface Expense {
  id: string;
  employee_id: string;
  employee_name: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  receipt_url?: string;
}

const EmployeeDashboard = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [currentEmployeeId] = useState("EMP-001"); // Mock logged-in employee
  const [currentEmployeeName] = useState("John Doe");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    amount: "",
    currency: "USD",
    description: "",
    date: new Date().toISOString().split('T')[0],
    receipt: null as File | null,
  });

  useEffect(() => {
    const storedExpenses = localStorage.getItem("expenses");
    if (storedExpenses) {
      setExpenses(JSON.parse(storedExpenses));
    } else {
      // Initialize with mock data
      const mockExpenses: Expense[] = [
        {
          id: "1",
          employee_id: "EMP-001",
          employee_name: "John Doe",
          amount: 150.00,
          currency: "USD",
          description: "Client lunch meeting",
          date: "2025-10-01",
          status: "pending",
        },
        {
          id: "3",
          employee_id: "EMP-001",
          employee_name: "John Doe",
          amount: 200.00,
          currency: "USD",
          description: "Travel expenses",
          date: "2025-10-03",
          status: "rejected",
        },
      ];
      setExpenses(mockExpenses);
      localStorage.setItem("expenses", JSON.stringify(mockExpenses));
    }
  }, []);

  const myExpenses = expenses.filter(exp => exp.employee_id === currentEmployeeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newExpense: Expense = {
      id: Date.now().toString(),
      employee_id: currentEmployeeId,
      employee_name: currentEmployeeName,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      description: formData.description,
      date: formData.date,
      status: "pending",
      receipt_url: formData.receipt ? URL.createObjectURL(formData.receipt) : undefined,
    };

    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);
    localStorage.setItem("expenses", JSON.stringify(updatedExpenses));

    toast({
      title: "Expense Submitted",
      description: "Your expense has been submitted for approval.",
    });

    setFormData({
      amount: "",
      currency: "USD",
      description: "",
      date: new Date().toISOString().split('T')[0],
      receipt: null,
    });
    setShowForm(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, receipt: e.target.files[0] });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending": return "outline";
      case "approved": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employee Dashboard</h1>
            <p className="text-muted-foreground">Manage your expenses</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Submit Expense
          </Button>
        </div>

        {/* Expense Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${myExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {myExpenses.filter(exp => exp.status === "pending").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {myExpenses.filter(exp => exp.status === "approved").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expenses List */}
        <Card>
          <CardHeader>
            <CardTitle>My Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {myExpenses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No expenses yet. Submit your first expense!</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myExpenses.map(expense => (
                    <TableRow key={expense.id}>
                      <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>{expense.currency} {expense.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(expense.status)} className="capitalize">
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {expense.receipt_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReceiptPreview(expense.receipt_url || null)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Submit Expense Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Submit New Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter expense description"
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
                  onChange={handleFileChange}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Expense</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Receipt Preview Dialog */}
        <Dialog open={!!receiptPreview} onOpenChange={() => setReceiptPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Receipt Preview</DialogTitle>
            </DialogHeader>
            {receiptPreview && (
              <img src={receiptPreview} alt="Receipt" className="w-full h-auto" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
