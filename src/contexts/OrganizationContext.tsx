import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: any;
}

interface UserRole {
  role: "admin" | "partner" | "associate" | "staff";
  organization: Organization;
}

interface OrganizationContextType {
  userRole: UserRole | null;
  loading: boolean;
  refreshUserRole: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider = ({ children, user }: { children: ReactNode; user: User | null }) => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async () => {
    if (!user) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          role,
          organization:organizations(id, name, slug, logo_url, settings)
        `)
        .eq("user_id", user.id)
        .maybeSingle(); // Use maybeSingle instead of single to handle 0 rows gracefully

      if (error) throw error;

      if (data && data.organization) {
        setUserRole({
          role: data.role,
          organization: data.organization as Organization,
        });
      } else {
        // User has no organization role assigned
        setUserRole(null);
      }
    } catch (error: any) {
      console.error("Error fetching user role:", error);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserRole();
  }, [user]);

  return (
    <OrganizationContext.Provider value={{ userRole, loading, refreshUserRole: fetchUserRole }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
};
