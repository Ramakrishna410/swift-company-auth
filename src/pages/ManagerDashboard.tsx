import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, CheckCircle, XCircle, Clock } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  employee_id: string;
  manager_id: string;
}

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

const ManagerDashboard = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [currentManagerId] = useState("MGR-001"); // Mock logged-in manager

  useEffect(() => {
    // Load data from localStorage or use mock data
    const storedEmployees = localStorage.getItem("employees");
    const storedExpenses = localStorage.getItem("expenses");

    if (storedEmployees) {
      setEmployees(JSON.parse(storedEmployees));
    } else {
      // Mock employee data
      const mockEmployees: Employee[] = [
        { id: "1", name: "John Doe", employee_id: "EMP-001", manager_id: "MGR-001" },
        { id: "2", name: "Jane Smith", employee_id: "EMP-002", manager_id: "MGR-001" },
        { id: "3", name: "Bob Johnson", employee_id: "EMP-003", manager_id: "MGR-001" },
      ];
      setEmployees(mockEmployees);
      localStorage.setItem("employees", JSON.stringify(mockEmployees));
    }

    if (storedExpenses) {
      setExpenses(JSON.parse(storedExpenses));
    } else {
      // Mock expense data
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
          id: "2",
          employee_id: "EMP-002",
          employee_name: "Jane Smith",
          amount: 85.50,
          currency: "USD",
          description: "Office supplies",
          date: "2025-10-02",
          status: "approved",
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

  const managerEmployees = employees.filter(emp => emp.manager_id === currentManagerId);

  const getExpenseSummary = () => {
    const summary = { pending: 0, approved: 0, rejected: 0, total: 0 };
    expenses.forEach(expense => {
      const employee = employees.find(emp => emp.employee_id === expense.employee_id);
      if (employee && employee.manager_id === currentManagerId) {
        summary[expense.status]++;
        summary.total += expense.amount;
      }
    });
    return summary;
  };

  const summary = getExpenseSummary();

  const filteredExpenses = selectedEmployee
    ? expenses.filter(exp => exp.employee_id === selectedEmployee)
    : expenses.filter(exp => {
        const employee = employees.find(e => e.employee_id === exp.employee_id);
        return employee && employee.manager_id === currentManagerId;
      });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending": return "outline";
      case "approved": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  const handleApprove = (expenseId: string) => {
    const updatedExpenses = expenses.map(exp =>
      exp.id === expenseId ? { ...exp, status: "approved" as const } : exp
    );
    setExpenses(updatedExpenses);
    localStorage.setItem("expenses", JSON.stringify(updatedExpenses));
  };

  const handleReject = (expenseId: string) => {
    const updatedExpenses = expenses.map(exp =>
      exp.id === expenseId ? { ...exp, status: "rejected" as const } : exp
    );
    setExpenses(updatedExpenses);
    localStorage.setItem("expenses", JSON.stringify(updatedExpenses));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
          <p className="text-muted-foreground">Overview of your team's expenses</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${summary.total.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Employees List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedEmployee === null ? "default" : "outline"}
                onClick={() => setSelectedEmployee(null)}
              >
                All Employees
              </Button>
              {managerEmployees.map(emp => (
                <Button
                  key={emp.id}
                  variant={selectedEmployee === emp.employee_id ? "default" : "outline"}
                  onClick={() => setSelectedEmployee(emp.employee_id)}
                >
                  {emp.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedEmployee
                ? `Expenses for ${managerEmployees.find(e => e.employee_id === selectedEmployee)?.name}`
                : "All Team Expenses"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No expenses found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map(expense => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.employee_name}</TableCell>
                      <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>{expense.currency} {expense.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(expense.status)} className="capitalize">
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {expense.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApprove(expense.id)}>
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleReject(expense.id)}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboard;
