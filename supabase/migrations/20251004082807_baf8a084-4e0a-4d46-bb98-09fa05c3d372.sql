-- Add currency fields to expenses table
ALTER TABLE public.expenses 
ADD COLUMN original_currency TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN original_amount NUMERIC,
ADD COLUMN converted_amount NUMERIC;

-- Update existing records to have original_amount equal to amount
UPDATE public.expenses SET original_amount = amount WHERE original_amount IS NULL;
UPDATE public.expenses SET converted_amount = amount WHERE converted_amount IS NULL;

-- Create approval_rules table for defining approval chains
CREATE TABLE public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sequence_order INTEGER NOT NULL,
  approver_role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, sequence_order)
);

-- Enable RLS on approval_rules
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

-- Create approval_records table for tracking individual approvals
CREATE TABLE public.approval_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  approver_role app_role NOT NULL,
  sequence_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  comments TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT approval_records_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Enable RLS on approval_records
ALTER TABLE public.approval_records ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at on approval_rules
CREATE TRIGGER update_approval_rules_updated_at
  BEFORE UPDATE ON public.approval_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add trigger for updated_at on approval_records
CREATE TRIGGER update_approval_records_updated_at
  BEFORE UPDATE ON public.approval_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies for approval_rules
CREATE POLICY "Users can view company approval rules"
  ON public.approval_rules
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage approval rules"
  ON public.approval_rules
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for approval_records
CREATE POLICY "Users can view own approval records"
  ON public.approval_records
  FOR SELECT
  USING (
    approver_id = auth.uid() OR
    expense_id IN (
      SELECT id FROM public.expenses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Approvers can update own records"
  ON public.approval_records
  FOR UPDATE
  USING (
    approver_id = auth.uid() AND status = 'pending'
  );

CREATE POLICY "System can create approval records"
  ON public.approval_records
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all company approval records"
  ON public.approval_records
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    expense_id IN (
      SELECT id FROM public.expenses 
      WHERE owner_id IN (
        SELECT id FROM public.profiles 
        WHERE company_id IN (
          SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Admins can override approval records"
  ON public.approval_records
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    expense_id IN (
      SELECT id FROM public.expenses 
      WHERE owner_id IN (
        SELECT id FROM public.profiles 
        WHERE company_id IN (
          SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
      )
    )
  );