-- Drop existing approval-related tables to rebuild cleanly
DROP TABLE IF EXISTS public.approval_records CASCADE;
DROP TABLE IF EXISTS public.approval_rules CASCADE;

-- Update companies table to ensure it has all needed fields
ALTER TABLE public.companies 
  DROP COLUMN IF EXISTS created_at CASCADE,
  DROP COLUMN IF EXISTS updated_at CASCADE;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Recreate approval_rules with new structure
CREATE TABLE public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage', 'specific', 'hybrid')),
  threshold NUMERIC,
  approver_role app_role,
  specific_approver_id UUID REFERENCES auth.users(id),
  hybrid_logic TEXT,
  sequence_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on approval_rules
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for approval_rules
CREATE POLICY "Users can view company approval rules"
  ON public.approval_rules FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage approval rules"
  ON public.approval_rules FOR ALL
  USING (
    has_role(auth.uid(), 'admin') 
    AND company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Recreate approval_records (approvals) with better structure
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  decision TEXT CHECK (decision IN ('pending', 'approved', 'rejected')),
  comment TEXT,
  sequence_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  decided_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on approvals
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

-- RLS policies for approvals
CREATE POLICY "Users can view own approval records"
  ON public.approvals FOR SELECT
  USING (
    approver_id = auth.uid() 
    OR expense_id IN (SELECT id FROM public.expenses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Approvers can update own records"
  ON public.approvals FOR UPDATE
  USING (approver_id = auth.uid() AND decision = 'pending');

CREATE POLICY "System can create approval records"
  ON public.approvals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all company approvals"
  ON public.approvals FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') 
    AND expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.profiles p ON e.owner_id = p.id
      WHERE p.company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Add category column to expenses if missing
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Update expenses RLS to allow admins full access
DROP POLICY IF EXISTS "Admins can view company expenses" ON public.expenses;
CREATE POLICY "Admins can view company expenses"
  ON public.expenses FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') 
    AND owner_id IN (
      SELECT id FROM public.profiles 
      WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update company expenses" ON public.expenses;
CREATE POLICY "Admins can update company expenses"
  ON public.expenses FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') 
    AND owner_id IN (
      SELECT id FROM public.profiles 
      WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_owner_company ON public.expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON public.approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_approvals_expense ON public.approvals(expense_id);
CREATE INDEX IF NOT EXISTS idx_approval_rules_company ON public.approval_rules(company_id);

-- Trigger for updated_at on approval_rules
CREATE TRIGGER update_approval_rules_updated_at
  BEFORE UPDATE ON public.approval_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger for updated_at on approvals
CREATE TRIGGER update_approvals_updated_at
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();