import "./App.css";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import MainPage from "./Screens/Entities/MainPage";
import ClientProfile from "./Screens/Clients/ClientProfile";
import ClientProjectInfo from "./Screens/Clients/ClientProjectInfo";
import EmployeeLanding from "./Screens/Employees/EmployeeLanding";
import EmployeeProjectInfo from "./Screens/Employees/EmployeeProjectInfo";
import TeamLeaderLanding from "./Screens/TeamLeader/TeamLeaderLanding";
import HeadProjectList from "./Screens/Head/HeadProjectList";
import TeamLeaderProjectAss from "./Screens/TeamLeader/TeamLeaderProjectAss";
import HeadClientProjectInfo from "./Screens/Head/HeadClientProjectInfo";
import PageNotFound from "./Screens/PageNotFound";
import { AuthContext } from "./Screens/Authentication/AuthContext";
import ProtectedRoute from "./Screens/Authentication/AuthContext";
import ErrorBoundary from "./Screens/Authentication/ErrorBoundry";
import TeamLeaderProjectInfo from "./Screens/TeamLeader/TeamLeaderProjectInfo";
import TeamLeaderProjectInfoWithEmployee from "./Screens/TeamLeader/TeamLeaderProjectInfoWithEmployee";
import { useGlobalPush } from "./hooks/useGlobalPush";
// NEW: Import timer starters and postData for logout
import { postData, startAccessTokenRefreshTimer, startRefreshTokenRefreshTimer } from "../src/BackendConnections/FetchBackendServices";

// AuthProvider (updated for timers on load)
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUserData = atob(localStorage.getItem("userData") || "");
      const storedRole = atob(localStorage.getItem("role") || "");
      // console.log("AuthProvider useEffect - storedUserData:", storedUserData, "storedRole:", storedRole);
      if (storedUserData && storedRole) {
        const parsedUserData = JSON.parse(storedUserData);
        setUser({
          username: parsedUserData.username || parsedUserData.email || parsedUserData.name || "unknown",
          role: storedRole,
        });
        // NEW: Start timers if exps exist (for persisted sessions)
        if (localStorage.getItem('accessTokenExp') && localStorage.getItem('refreshTokenExp')) {
          startAccessTokenRefreshTimer();
          startRefreshTokenRefreshTimer();
        }
      }
    } catch (error) {
      // console.error("Error parsing localStorage userData:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (userData: { username: string; role: string }) => {
    setUser(userData);
  };

  // UPDATED: Make logout async to call backend and clear exps
  const logout = async () => {
    try {
      // Call backend to clear cookies (adjust endpoint for other roles if needed)
      await postData('head/logout', {});
    } catch (error) {
      // console.error('Error during backend logout:', error);
    } finally {
      setUser(null);
      localStorage.removeItem("role");
      localStorage.removeItem("userData");
      // NEW: Clear token exps to stop timers and match logoutAndRedirect
      localStorage.removeItem("accessTokenExp");
      localStorage.removeItem("refreshTokenExp");
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

// REMOVED: HeadRoutesWrapper (redundant with global push) – now just routes directly

// AppRoutes (unchanged, but removed wrapper)
const AppRoutes = () => {
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error("AppRoutes component must be used within an AuthProvider");
  }

  const { user: authUser, isLoading } = authContext;

  const getHomePage = () => {
    if (isLoading) return null;
    if (!authUser) return "/login-reg";
    switch (authUser.role) {
      case "Employee":
        return "/employeelanding";
      case "Client":
        return "/clientprofile";
      case "Head":
        return "/headprojectlist";
      case "Team Leader":
        return "/teamleaderlanding";
      default:
        return "/login-reg";
    }
  };

  // console.log("authUser in AppRoutes:", authUser, "isLoading:", isLoading);

  // ... (employeeProfile, clientProject objects unchanged)

  if (isLoading) {
    return <div>Loading...</div>; // Or spinner
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={getHomePage() || "/login-reg"} replace />} />
      <Route path="/login-reg" element={authUser ? <Navigate to={getHomePage() || "/login-reg"} replace /> : <MainPage />} />
      {/* <Route path="/employeeprofile" element={<ProtectedRoute allowedRoles={["Employee"]}> <EmployeeProfile {...employeeProfile} /> </ProtectedRoute>} /> */}
      <Route path="/employeelanding" element={<ProtectedRoute allowedRoles={["Employee"]}> <EmployeeLanding /> </ProtectedRoute>} />
      <Route path="/employeeprojectinfo" element={<ProtectedRoute allowedRoles={["Employee"]}> <EmployeeProjectInfo /> </ProtectedRoute>} />
      <Route path="/clientprofile" element={<ProtectedRoute allowedRoles={["Client"]}> <ClientProfile /> </ProtectedRoute>} />
      <Route path="/projectupload" element={<ProtectedRoute allowedRoles={["Client"]}> <ClientProjectInfo /> </ProtectedRoute>} />
      <Route path="/teamleaderlanding" element={<ProtectedRoute allowedRoles={["Team Leader"]}> <TeamLeaderLanding /> </ProtectedRoute>} />
      <Route path="/teamleaderprojectinfo" element={<ProtectedRoute allowedRoles={["Team Leader"]}> <TeamLeaderProjectInfo /> </ProtectedRoute>} />
      <Route path="/teamleaderprojectinfo_withemployee" element={<ProtectedRoute allowedRoles={["Team Leader"]}> <TeamLeaderProjectInfoWithEmployee /> </ProtectedRoute>} />
      <Route path="/teamleaderprojectass" element={<ProtectedRoute allowedRoles={["Team Leader"]}> <TeamLeaderProjectAss /> </ProtectedRoute>} />
      {/* FIXED: Direct Head routes (global push handles notifications) */}
      <Route path="/headprojectlist" element={<ProtectedRoute allowedRoles={["Head"]}> <HeadProjectList /> </ProtectedRoute>} />
      <Route path="/headclientprojectinfo" element={<ProtectedRoute allowedRoles={["Head"]}> <HeadClientProjectInfo /> </ProtectedRoute>} />
      <Route path="/page_not_found" element={<ProtectedRoute allowedRoles={["Employee", "Client", "Head", "Team Leader"]}> <PageNotFound /> </ProtectedRoute>} />
      <Route path="*" element={authUser ? <Navigate to="/page_not_found" replace /> : <Navigate to="/login-reg" replace />} />
    </Routes>
  );
};

// Main App
function App() {
  const storedUserData = localStorage.getItem("userData");
  const parsedData = storedUserData ? JSON.parse(atob(storedUserData)) : null;
  const headId = parsedData?.headId || null;

  // Global push
  useGlobalPush(headId || '', 'head');

  // NEW: Global SW registration (ensures ready for notifications)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('Global SW registered:', reg))
        .catch(err => console.error('SW registration failed:', err));
    }
  }, []);

  // NEW: PWA Install Prompt State & Effect
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Listen for install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', () => {});
    };
  }, []);

  // Function to handle install
  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  // Show button only for Head role (from localStorage)
  const isHead = parsedData?.role === "Head";

  return (
    <AuthProvider>
      <div className="font-librefranklin">
        {/* NEW: PWA Install Button (global, top-right, only for Head) */}
        {deferredPrompt && !isInstalled && isHead && (
          <button 
            onClick={handleInstall}
            className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded z-50 shadow-lg hover:bg-blue-600"
          >
            📱 Install App for Offline Notifications
          </button>
        )}
        <Router>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </Router>
      </div>
    </AuthProvider>
  );
}

export default App;