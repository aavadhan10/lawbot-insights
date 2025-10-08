import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { toast } from "sonner";

const ALLOWED_DOMAINS = [
  '@brieflylegal.com',
  '@rimonlaw.com',
  '@caravellaw.com',
  '@scalefirm.com'
];

interface AuthProps {
  initialIsSignUp?: boolean;
  onAuthSuccess?: () => void;
}

export const Auth = ({ initialIsSignUp = false, onAuthSuccess }: AuthProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [organizations, setOrganizations] = useState<any[]>([]);

  useEffect(() => {
    const fetchOrganizations = async () => {
      const { data, error } = await supabase.from("organizations").select("*");
      if (!error && data) {
        setOrganizations(data);
        if (data.length > 0) setSelectedOrg(data[0].id);
      }
    };
    fetchOrganizations();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate email domain
      const emailDomain = email.substring(email.lastIndexOf('@'));
      if (!ALLOWED_DOMAINS.includes(emailDomain)) {
        toast.error(`Only users with ${ALLOWED_DOMAINS.join(', ')} email addresses can access this system`);
        setIsLoading(false);
        return;
      }

      if (isSignUp) {
        if (!fullName.trim()) {
          toast.error("Please enter your full name");
          setIsLoading(false);
          return;
        }
        if (!selectedOrg) {
          toast.error("Please select your organization");
          setIsLoading(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: roleError } = await supabase.from("user_roles").insert({
            user_id: authData.user.id,
            organization_id: selectedOrg,
            role: "associate",
          });

          if (roleError) throw roleError;
        }

        toast.success("Account created! You're now signed in.");
        onAuthSuccess?.();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Signed in successfully!");
        onAuthSuccess?.();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary-glow">
              <Brain className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Briefly
          </h1>
          <p className="text-muted-foreground">
            {isSignUp ? "Create your account" : "Welcome back"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <select
                  className="w-full px-3 py-2 rounded-md border border-input bg-background"
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  required
                  disabled={isLoading}
                >
                  <option value="">Select your organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            disabled={isLoading}
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </Card>
    </div>
  );
};
