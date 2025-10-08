import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, FileSearch, MessageSquare, BarChart3 } from "lucide-react";
import { Auth } from "@/components/Auth";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const Landing = () => {
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuthClick = (signUp: boolean) => {
    setIsSignUp(signUp);
    setShowAuth(true);
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
    navigate("/assistant");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary-glow">
                <Brain className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Briefly AI Co-Pilot
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => handleAuthClick(false)}>
                Login
              </Button>
              <Button onClick={() => handleAuthClick(true)}>
                Create Account
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-block px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <p className="text-sm font-medium text-primary">Available to Partnering Law Firms with Briefly</p>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold leading-tight text-primary">
            Briefly AI Co-Pilot
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            AI-powered platform built for legal professionals partnering with Briefly Legal
          </p>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Streamline drafting, review, and legal service communication with cutting-edge AI technology. We don't train on your data—your information stays confidential.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => handleAuthClick(false)}
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-6"
              onClick={() => handleAuthClick(true)}
            >
              Request Access
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-32 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-all hover:border-primary/50">
            <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Legal Chat</h3>
            <p className="text-muted-foreground text-sm">
              Ask questions in natural language and get detailed legal insights. Perfect for quick consultations, drafting support, and legal reasoning.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-all hover:border-primary/50">
            <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Data Insights</h3>
            <p className="text-muted-foreground text-sm">
              Transform legal data into actionable insights. Generate visualizations, track matter analytics, and make data-driven decisions.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-all hover:border-primary/50">
            <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
              <FileSearch className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Document Drafting</h3>
            <p className="text-muted-foreground text-sm">
              Generate legal documents with AI assistance. Draft contracts, agreements, and legal communications faster with intelligent templates.
            </p>
          </div>
        </div>

        {/* Why Briefly AI Assistant Section */}
        <div className="mt-32 max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Briefly AI Co-Pilot?</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Built by legal innovators, for legal professionals
              </p>
            </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-xl bg-card border border-border">
              <h3 className="text-xl font-semibold mb-3">Purpose-Built for Legal Work</h3>
              <p className="text-muted-foreground">
                Unlike generic AI tools, Briefly AI Co-Pilot understands legal terminology, reasoning, and workflows. It's designed specifically to support the unique needs of legal professionals.
              </p>
            </div>

            <div className="p-8 rounded-xl bg-card border border-border">
              <h3 className="text-xl font-semibold mb-3">Completely Free for Partners</h3>
              <p className="text-muted-foreground">
                Available at no cost to our partnering law firms: Briefly Legal, Rimon Law, Caravel Law, and Scale Firm. No hidden fees, no usage limits.
              </p>
            </div>

            <div className="p-8 rounded-xl bg-card border border-border">
              <h3 className="text-xl font-semibold mb-3">Secure & Confidential</h3>
              <p className="text-muted-foreground">
                Your data is protected with enterprise-grade security. We understand the importance of attorney-client privilege and confidentiality in legal work.
              </p>
            </div>

            <div className="p-8 rounded-xl bg-card border border-border">
              <h3 className="text-xl font-semibold mb-3">Continuous Innovation</h3>
              <p className="text-muted-foreground">
                Powered by the Office of Innovation, we're constantly improving and adding new features based on real feedback from legal professionals.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm mt-32">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Briefly AI Co-Pilot
              </h3>
              <p className="text-sm text-muted-foreground">
                AI-powered legal support for our partnering law firms and legal operations teams.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Partnering Firms</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Briefly Legal (@brieflylegal.com)</li>
                <li>Rimon Law (@rimonlaw.com)</li>
                <li>Caravel Law (@caravellaw.com)</li>
                <li>Scale Firm (@scalefirm.com)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Support</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Need help or want to request access?
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleAuthClick(true)}
              >
                Contact Us
              </Button>
            </div>
          </div>

          <div className="border-t border-border/50 mt-8 pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © 2025 Briefly Legal Office of Innovation. Secure, Confidential, and Built for Legal Professionals.
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Dialog */}
      <Dialog open={showAuth} onOpenChange={setShowAuth}>
        <DialogContent className="sm:max-w-[500px] p-0 bg-transparent border-0">
          <Auth initialIsSignUp={isSignUp} onAuthSuccess={handleAuthSuccess} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
