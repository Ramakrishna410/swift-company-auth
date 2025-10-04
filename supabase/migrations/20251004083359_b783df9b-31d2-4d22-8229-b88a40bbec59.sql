-- Drop existing approval_rules table to recreate with new structure
DROP TABLE IF EXISTS public.approval_rules CASCADE;

-- Create enhanced approval_rules table with conditional logic support
CREATE TABLE public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage', 'specific_approver', 'hybrid', 'sequential')),
  
  -- For percentage rules
  required_percentage INTEGER,
  
  -- For specific approver rules
  specific_approver_id UUID REFERENCES auth.users(id),
  specific_approver_role app_role,
  
  -- For hybrid rules
  hybrid_logic TEXT, -- 'AND' or 'OR'
  hybrid_percentage INTEGER,
  hybrid_approver_id UUID REFERENCES auth.users(id),
  hybrid_approver_role app_role,
  
  -- For sequential rules (legacy support)
  sequence_order INTEGER,
  approver_role app_role,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at
CREATE TRIGGER update_approval_rules_updated_at
  BEFORE UPDATE ON public.approval_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies
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

-- Add receipt_url column to expenses if not exists
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS receipt_url TEXT;