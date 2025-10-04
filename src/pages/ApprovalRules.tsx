import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Trash2, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ApprovalRules() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<"percentage" | "specific_approver" | "hybrid">("percentage");
  const [percentage, setPercentage] = useState("50");
  const [specificRole, setSpecificRole] = useState<string>("");
  const [hybridLogic, setHybridLogic] = useState<"AND" | "OR">("OR");
  const [hybridPercentage, setHybridPercentage] = useState("60");
  const [hybridRole, setHybridRole] = useState<string>("");

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['isAdmin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
      return !!data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (isAdmin === false) {
      toast.error("Access denied. Only admins can manage approval rules.");
      navigate("/");
    }
  }, [isAdmin, navigate]);

  // Fetch company data
  const { data: companyData } = useQuery({
    queryKey: ['company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      if (!profile) return null;
      
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();
      
      return company;
    },
    enabled: !!user?.id && !!isAdmin,
  });

  // Fetch approval rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ['approval-rules', companyData?.id],
    queryFn: async () => {
      if (!companyData?.id) return [];
      const { data } = await supabase
        .from('approval_rules')
        .select('*')
        .eq('company_id', companyData.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!companyData?.id,
  });

  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async () => {
      if (!companyData?.id) throw new Error("Company not found");

      const ruleData: any = {
        company_id: companyData.id,
        name: ruleName,
        rule_type: ruleType,
        is_active: true,
      };

      if (ruleType === "percentage") {
        ruleData.required_percentage = parseInt(percentage);
      } else if (ruleType === "specific_approver") {
        ruleData.specific_approver_role = specificRole;
      } else if (ruleType === "hybrid") {
        ruleData.hybrid_logic = hybridLogic;
        ruleData.hybrid_percentage = parseInt(hybridPercentage);
        ruleData.hybrid_approver_role = hybridRole;
      }

      const { error } = await supabase
        .from('approval_rules')
        .insert(ruleData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approval rule created successfully!");
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to create rule", { description: error.message });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('approval_rules')
        .delete()
        .eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rule deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
    },
    onError: (error: any) => {
      toast.error("Failed to delete rule", { description: error.message });
    },
  });

  const resetForm = () => {
    setRuleName("");
    setRuleType("percentage");
    setPercentage("50");
    setSpecificRole("");
    setHybridLogic("OR");
    setHybridPercentage("60");
    setHybridRole("");
  };

  const handleCreateRule = () => {
    if (!ruleName.trim()) {
      toast.error("Please enter a rule name");
      return;
    }

    if (ruleType === "percentage" && (!percentage || parseInt(percentage) < 1 || parseInt(percentage) > 100)) {
      toast.error("Percentage must be between 1 and 100");
      return;
    }

    if (ruleType === "specific_approver" && !specificRole) {
      toast.error("Please select an approver role");
      return;
    }

    if (ruleType === "hybrid" && (!hybridPercentage || !hybridRole)) {
      toast.error("Please fill all hybrid rule fields");
      return;
    }

    createRuleMutation.mutate();
  };

  const getRuleDescription = (rule: any) => {
    if (rule.rule_type === "percentage") {
      return `${rule.required_percentage}% of approvers must approve`;
    } else if (rule.rule_type === "specific_approver") {
      return `${rule.specific_approver_role} must approve`;
    } else if (rule.rule_type === "hybrid") {
      return `${rule.hybrid_percentage}% ${rule.hybrid_logic} ${rule.hybrid_approver_role} approves`;
    }
    return "Unknown rule type";
  };

  if (isAdmin === false) {
    return null;
  }
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Settings className="h-8 w-8 text-primary" />
              Approval Rules
            </h2>
            <p className="text-muted-foreground">
              Configure conditional approval workflows for {companyData?.name}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Approval Rule</DialogTitle>
                <DialogDescription>
                  Define a conditional approval rule for expense approval workflow
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Rule Name</Label>
                  <Input
                    id="rule-name"
                    placeholder="e.g., Standard Approval"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rule-type">Rule Type</Label>
                  <Select value={ruleType} onValueChange={(val: any) => setRuleType(val)}>
                    <SelectTrigger id="rule-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage Rule</SelectItem>
                      <SelectItem value="specific_approver">Specific Approver</SelectItem>
                      <SelectItem value="hybrid">Hybrid Rule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {ruleType === "percentage" && (
                  <div className="space-y-2">
                    <Label htmlFor="percentage">Required Percentage</Label>
                    <Input
                      id="percentage"
                      type="number"
                      min="1"
                      max="100"
                      placeholder="50"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      If {percentage}% of approvers approve, the expense is auto-approved
                    </p>
                  </div>
                )}

                {ruleType === "specific_approver" && (
                  <div className="space-y-2">
                    <Label htmlFor="specific-role">Approver Role</Label>
                    <Select value={specificRole} onValueChange={setSpecificRole}>
                      <SelectTrigger id="specific-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      If this role approves, the expense is auto-approved
                    </p>
                  </div>
                )}

                {ruleType === "hybrid" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="hybrid-percentage">Percentage</Label>
                        <Input
                          id="hybrid-percentage"
                          type="number"
                          min="1"
                          max="100"
                          value={hybridPercentage}
                          onChange={(e) => setHybridPercentage(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hybrid-logic">Logic</Label>
                        <Select value={hybridLogic} onValueChange={(val: any) => setHybridLogic(val)}>
                          <SelectTrigger id="hybrid-logic">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OR">OR</SelectItem>
                            <SelectItem value="AND">AND</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hybrid-role">Specific Role</Label>
                      <Select value={hybridRole} onValueChange={setHybridRole}>
                        <SelectTrigger id="hybrid-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {hybridPercentage}% {hybridLogic} {hybridRole || "[Role]"} approves → Auto-approved
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRule} disabled={createRuleMutation.isPending}>
                  {createRuleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Rule"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Approval Rules</CardTitle>
            <CardDescription>
              Manage conditional approval rules for your company
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !rules || rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-semibold mb-2">No approval rules</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first approval rule to automate expense workflows
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule: any) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {rule.rule_type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{getRuleDescription(rule)}</TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? "default" : "secondary"}>
                            {rule.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                            disabled={deleteRuleMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
