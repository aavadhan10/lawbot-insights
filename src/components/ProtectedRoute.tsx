import { Navigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { userRole, loading } = useOrganization();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
