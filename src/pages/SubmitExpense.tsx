import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, ScanLine } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

const expenseFormSchema = z.object({
  amount: z.string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number",
    }),
  currency: z.string().min(1, "Currency is required"),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must be less than 500 characters"),
  date: z.date({
    required_error: "Expense date is required",
  }),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export default function SubmitExpense() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch company currency
  const { data: companyData } = useQuery({
    queryKey: ['company-currency', user?.id],
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
        .select('currency')
        .eq('id', profile.company_id)
        .single();
      
      return company;
    },
    enabled: !!user?.id,
  });

  // Fetch approval rules for the company
  const { data: approvalRules } = useQuery({
    queryKey: ['approval-rules', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      if (!profile) return [];
      
      const { data: rules } = await supabase
        .from('approval_rules')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('sequence_order');
      
      return rules || [];
    },
    enabled: !!user?.id,
  });

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: "",
      currency: companyData?.currency || "USD",
      description: "",
      date: new Date(),
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormValues) => {
      const originalAmount = parseFloat(data.amount);
      const originalCurrency = data.currency;
      const companyCurrency = companyData?.currency || 'USD';
      
      let convertedAmount = originalAmount;
      
      // Convert currency if different from company currency
      if (originalCurrency !== companyCurrency) {
        try {
          const response = await fetch(
            `https://api.exchangerate-api.com/v4/latest/${originalCurrency}`
          );
          const rates = await response.json();
          const rate = rates.rates[companyCurrency];
          convertedAmount = originalAmount * rate;
          console.log(`Converted ${originalAmount} ${originalCurrency} to ${convertedAmount} ${companyCurrency}`);
        } catch (error) {
          console.error('Currency conversion failed:', error);
          toast.error('Failed to convert currency, using original amount');
        }
      }
      
      // Create expense
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          amount: convertedAmount,
          currency: companyCurrency,
          original_amount: originalAmount,
          original_currency: originalCurrency,
          converted_amount: convertedAmount,
          description: data.description,
          date: data.date.toISOString(),
          owner_id: user?.id,
          status: 'pending',
        })
        .select()
        .single();

      if (expenseError) throw expenseError;
      
      // Create approval records for BOTH Manager AND Admin
      // Get the user's profile and company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();
      
      if (profile?.company_id) {
        // Get the employee's manager from user_roles
        const { data: employeeRole } = await supabase
          .from('user_roles')
          .select('manager_id')
          .eq('user_id', user?.id)
          .maybeSingle();
        
        // Get all company users with their roles
        const { data: companyProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_id', profile.company_id);
        
        if (companyProfiles && companyProfiles.length > 0) {
          const companyUserIds = companyProfiles.map(p => p.id);
          
          // Get all admins in the company
          const { data: adminRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
            .in('user_id', companyUserIds);
          
          // Create approval records for admins
          if (adminRoles && adminRoles.length > 0) {
            const approvalRecords = adminRoles.map(admin => ({
              expense_id: expenseData.id,
              approver_id: admin.user_id,
              decision: 'pending',
              sequence_order: 2,
            }));
            
            const { error: adminApprovalError } = await supabase
              .from('approvals')
              .insert(approvalRecords);
            
            if (adminApprovalError) {
              console.error('Failed to create admin approvals:', adminApprovalError);
            }
          }
          
          // Create approval record for manager if assigned
          if (employeeRole?.manager_id) {
            const { error: managerApprovalError } = await supabase
              .from('approvals')
              .insert({
                expense_id: expenseData.id,
                approver_id: employeeRole.manager_id,
                decision: 'pending',
                sequence_order: 1,
              });
            
            if (managerApprovalError) {
              console.error('Failed to create manager approval:', managerApprovalError);
            }
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Expense submitted successfully!");
      form.reset({
        amount: "",
        currency: companyData?.currency || "USD",
        description: "",
      });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error: any) => {
      toast.error("Failed to submit expense", {
        description: error.message,
      });
    },
  });

  const handleScanReceipt = async () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsScanning(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // Call OCR edge function
        const { data, error } = await supabase.functions.invoke('scan-receipt', {
          body: { imageBase64: base64String }
        });

        if (error) {
          if (error.message.includes('429') || error.message.includes('Rate limit')) {
            toast.error('Rate limit exceeded. Please try again later.');
          } else if (error.message.includes('402') || error.message.includes('Payment required')) {
            toast.error('AI credits required. Please add credits to your workspace.');
          } else {
            toast.error('Failed to scan receipt', { description: error.message });
          }
          return;
        }

        if (data) {
          // Auto-fill form with extracted data
          if (data.amount) {
            form.setValue('amount', data.amount.toString());
          }
          if (data.date) {
            form.setValue('date', new Date(data.date));
          }
          if (data.currency) {
            form.setValue('currency', data.currency);
          }
          toast.success('Receipt scanned successfully!');
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error('Failed to scan receipt', {
        description: error.message,
      });
    } finally {
      setIsScanning(false);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const onSubmit = async (data: ExpenseFormValues) => {
    setIsSubmitting(true);
    try {
      await createExpenseMutation.mutateAsync(data);
      // Reset form after successful submission
      form.reset({
        amount: "",
        currency: companyData?.currency || "USD",
        description: "",
        date: new Date(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Submit Expense</h2>
          <p className="text-muted-foreground">Create a new expense report</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>New Expense Form</CardTitle>
                <CardDescription>Fill out the details for your expense</CardDescription>
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleScanReceipt}
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <ScanLine className="mr-2 h-4 w-4" />
                      Scan Receipt
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Amount and Currency Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                            <SelectItem value="EUR">EUR - Euro</SelectItem>
                            <SelectItem value="GBP">GBP - British Pound</SelectItem>
                            <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                            <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                            <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Date Picker */}
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expense Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("2020-01-01")
                            }
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Select the date when the expense occurred
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the expense in detail..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide a detailed description (10-500 characters)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Expense"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={isSubmitting}
                  >
                    Clear Form
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}