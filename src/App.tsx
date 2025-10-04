import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SubmitExpense from "./pages/SubmitExpense";
import MyExpenses from "./pages/MyExpenses";
import PendingApprovals from "./pages/PendingApprovals";
import TeamExpenses from "./pages/TeamExpenses";
import ManageUsers from "./pages/ManageUsers";
import AllExpenses from "./pages/AllExpenses";
import ApprovalRules from "./pages/ApprovalRules";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />
            <Route path="/submit-expense" element={<ProtectedRoute><SubmitExpense /></ProtectedRoute>} />
            <Route path="/my-expenses" element={<ProtectedRoute><MyExpenses /></ProtectedRoute>} />
            <Route path="/pending-approvals" element={<ProtectedRoute><PendingApprovals /></ProtectedRoute>} />
            <Route path="/team-expenses" element={<ProtectedRoute><TeamExpenses /></ProtectedRoute>} />
            <Route path="/manage-users" element={<ProtectedRoute><ManageUsers /></ProtectedRoute>} />
            <Route path="/all-expenses" element={<ProtectedRoute><AllExpenses /></ProtectedRoute>} />
            <Route path="/approval-rules" element={<ProtectedRoute><ApprovalRules /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
