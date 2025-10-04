import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { DollarSign, FileText, Users, CheckCircle, ClipboardList, UserCog } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const quickActions = [
    {
      title: "Submit Expense",
      description: "Create a new expense report",
      icon: DollarSign,
      onClick: () => navigate("/submit-expense"),
    },
    {
      title: "My Expenses",
      description: "View your expense history",
      icon: FileText,
      onClick: () => navigate("/my-expenses"),
    },
    {
      title: "Pending Approvals",
      description: "Review expenses awaiting approval",
      icon: CheckCircle,
      onClick: () => navigate("/pending-approvals"),
    },
    {
      title: "Team Expenses",
      description: "View team expense reports",
      icon: Users,
      onClick: () => navigate("/team-expenses"),
    },
    {
      title: "Manager Dashboard",
      description: "Manage team expenses (No Database)",
      icon: UserCog,
      onClick: () => navigate("/manager-dashboard"),
    },
    {
      title: "Employee Dashboard",
      description: "Submit & track expenses (No Database)",
      icon: ClipboardList,
      onClick: () => navigate("/employee-dashboard"),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome to your expense management dashboard
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Card key={action.title} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={action.onClick}>
              <CardHeader>
                <action.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
