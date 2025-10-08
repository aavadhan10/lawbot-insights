import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Landing } from "@/components/Landing";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NoOrganizationWarning } from "@/components/NoOrganizationWarning";
import Assistant from "./pages/Assistant";
import Repository from "./pages/Repository";
import DocumentDrafter from "./pages/DocumentDrafter";
import HistoryPage from "./pages/HistoryPage";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import type { User } from "@supabase/supabase-js";

const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <OrganizationProvider user={user}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/assistant" element={<ProtectedRoute><AppContent><Assistant /></AppContent></ProtectedRoute>} />
              <Route path="/repository" element={<ProtectedRoute><AppContent><Repository /></AppContent></ProtectedRoute>} />
              <Route path="/drafter" element={<ProtectedRoute><AppContent><DocumentDrafter /></AppContent></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><AppContent><HistoryPage /></AppContent></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><AppContent><Settings /></AppContent></ProtectedRoute>} />
              <Route path="/help" element={<ProtectedRoute><AppContent><Help /></AppContent></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </OrganizationProvider>
    </QueryClientProvider>
  );
};

const AppContent = ({ children }: { children: React.ReactNode }) => {
  const { userRole } = useOrganization();

  if (!userRole) {
    return (
      <div className="min-h-screen">
        <NoOrganizationWarning />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default App;
