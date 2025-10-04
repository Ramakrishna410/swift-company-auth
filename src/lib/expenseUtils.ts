// Utility functions for expense management

export const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "success" => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'outline'; // yellow-ish
    case 'approved':
      return 'success'; // green with white text for better visibility
    case 'rejected':
      return 'destructive'; // red
    default:
      return 'secondary';
  }
};

export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'approved':
      return 'text-green-600 dark:text-green-400';
    case 'rejected':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
};