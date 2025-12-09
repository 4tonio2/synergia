import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { ReactNode, useEffect } from "react";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect to /landing if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && location !== '/landing') {
      setLocation('/landing');
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Return null while redirecting to /landing
  if (!isAuthenticated) {
    return null;
  }

  // Show children (protected content) if authenticated
  return <>{children}</>;
}
