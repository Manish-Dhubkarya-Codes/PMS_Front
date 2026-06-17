import { createContext, useContext } from "react";
import { Navigate } from "react-router-dom";

interface AuthContextType {
  user: { username: string; role: string } | null;
  login: (userData: { username: string; role: string }) => void;
  logout: () => void;
  isLoading: boolean; // Add isLoading to context
}

// Create AuthContext with null as the default value
export const AuthContext = createContext<AuthContextType | null>(null);

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const authContext = useContext(AuthContext);

  // Check if context is available
  if (!authContext) {
    throw new Error("ProtectedRoute must be used within an AuthProvider");
  }

  const { user, isLoading } = authContext;

  // While loading, render nothing (or a loading spinner) to prevent premature redirects
  if (isLoading) {
    return null; // Or <div>Loading...</div> for a loading spinner
  }

  // If no user is logged in, redirect to login
  if (!user) {
    return <Navigate to="/login-reg" replace />;
  }

  // If user role is not in allowed roles, redirect to page not found
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/page_not_found" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;