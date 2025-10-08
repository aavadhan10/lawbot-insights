import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatInterface } from "@/components/ChatInterface";
import { DataDashboard } from "@/components/DataDashboard";
import { ChatHistory } from "@/components/ChatHistory";
import { Landing } from "@/components/Landing";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [visualizations, setVisualizations] = useState<any[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    // Load last conversation from localStorage on mount
    const saved = localStorage.getItem('lastConversationId');
    return saved || null;
  });

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

  // Save conversation to localStorage when it changes
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('lastConversationId', currentConversationId);
    }
  }, [currentConversationId]);

  const handleDataUpload = (data: any) => {
    setUploadedData(data);
    setShowDashboard(true);
  };

  const handleReset = () => {
    setUploadedData(null);
    setVisualizations([]);
    setForecasts([]);
    setShowDashboard(false);
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    localStorage.removeItem('lastConversationId');
    setUploadedData(null);
    setVisualizations([]);
    setForecasts([]);
    setShowDashboard(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  return (
    <OrganizationProvider user={user}>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary-glow">
                  <Brain className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Briefly AI Co-Pilot
                  </h1>
                  <p className="text-sm text-muted-foreground">Legal Intelligence Platform</p>
                </div>
              </div>
              {uploadedData && showDashboard && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDashboard(!showDashboard)}
                >
                  {showDashboard ? "Hide Dashboard" : "Show Dashboard"}
                </Button>
              )}
            </div>
          </div>
        </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Chat History Sidebar */}
        <ChatHistory
          currentConversationId={currentConversationId}
          onSelectConversation={setCurrentConversationId}
          onNewChat={handleNewChat}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* Chat Interface */}
          <div className={`flex-1 transition-all duration-300 ${showDashboard && uploadedData ? 'lg:max-w-[50%]' : 'max-w-4xl mx-auto w-full'}`}>
            <ChatInterface
              data={uploadedData}
              onInsights={setInsights}
              onReset={handleReset}
              onVisualization={(viz) => setVisualizations(prev => [...prev, viz])}
              onForecast={(forecast) => setForecasts(prev => [...prev, forecast])}
              onDataUpload={handleDataUpload}
              conversationId={currentConversationId}
              onConversationCreated={setCurrentConversationId}
            />
          </div>

          {/* Dashboard */}
          {uploadedData && showDashboard && (
            <div className="flex-1 transition-all duration-300 animate-in slide-in-from-right overflow-auto">
              <DataDashboard
                data={uploadedData}
                insights={insights}
                visualizations={visualizations}
                forecasts={forecasts}
              />
            </div>
          )}
        </div>
      </main>
    </div>
    </OrganizationProvider>
  );
};

export default Index;
