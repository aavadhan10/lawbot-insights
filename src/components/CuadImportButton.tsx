import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { BookOpen, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VectorizationStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export function CuadImportButton() {
  const [isImporting, setIsImporting] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [vectorizationStatus, setVectorizationStatus] = useState<VectorizationStatus | null>(null);
  const [alreadyImported, setAlreadyImported] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");

  useEffect(() => {
    checkExistingImport();
    if (showProgress) {
      const interval = setInterval(checkVectorizationStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [showProgress]);

  const checkExistingImport = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) return;

      const { data, error } = await supabase
        .from('documents')
        .select('id')
        .eq('organization_id', userRole.organization_id)
        .eq('file_type', 'cuad_contract')
        .limit(1);

      if (!error && data && data.length > 0) {
        setAlreadyImported(true);
        checkVectorizationStatus();
      }
    } catch (error) {
      console.error('Error checking existing import:', error);
    }
  };

  const checkVectorizationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) return;

      const { data, error } = await supabase.functions.invoke('check-vectorization-status', {
        body: { organizationId: userRole.organization_id }
      });

      if (!error && data?.status) {
        setVectorizationStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking vectorization status:', error);
    }
  };

  const handleImport = async () => {
    if (!githubUrl.trim()) {
      toast.error("Please enter the GitHub raw URL for CUAD_v1.json");
      return;
    }

    setIsImporting(true);
    setShowProgress(true);
    setImportProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to import CUAD dataset");
        return;
      }

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) {
        toast.error("User role not found");
        return;
      }

      toast.info("Starting CUAD import...");

      const { data, error } = await supabase.functions.invoke('import-cuad-batch', {
        body: {
          githubUrl: githubUrl.trim(),
          organizationId: userRole.organization_id,
          userId: user.id,
        }
      });

      if (error) throw error;

      setImportProgress(100);
      setAlreadyImported(true);

      toast.success(
        `Import complete! ${data.summary.imported} contracts imported, ${data.summary.skipped} skipped`
      );

      // Start vectorization for imported contracts
      if (data.summary.imported > 0) {
        toast.info("Starting vectorization process...");
        startVectorization(userRole.organization_id);
      }

    } catch (error: any) {
      console.error('Error importing CUAD:', error);
      toast.error(error.message || "Failed to import CUAD dataset");
    } finally {
      setIsImporting(false);
    }
  };

  const startVectorization = async (organizationId: string) => {
    try {
      // Get all pending CUAD documents
      const { data: documents } = await supabase
        .from('documents')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('file_type', 'cuad_contract')
        .eq('vectorization_status', 'pending')
        .limit(10);

      if (!documents || documents.length === 0) return;

      // Trigger vectorization for each document (10 at a time)
      const promises = documents.map(doc =>
        supabase.functions.invoke('embed-document', {
          body: { documentId: doc.id }
        })
      );

      await Promise.all(promises);
      checkVectorizationStatus();

    } catch (error) {
      console.error('Error starting vectorization:', error);
    }
  };

  const vectorizationProgress = vectorizationStatus 
    ? (vectorizationStatus.completed / vectorizationStatus.total) * 100 
    : 0;

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>CUAD Dataset</CardTitle>
              <CardDescription>
                510 real-world commercial contracts with expert legal annotations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Import the Contract Understanding Atticus Dataset - includes NDAs, 
            distribution agreements, employment contracts, and more with 41 
            clause types annotated by legal experts.
          </p>

          {alreadyImported && vectorizationStatus && (
            <div className="space-y-2 p-4 bg-background/50 rounded-lg border">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Dataset Status</span>
                <span className="text-muted-foreground">
                  {vectorizationStatus.completed}/{vectorizationStatus.total} vectorized
                </span>
              </div>
              <Progress value={vectorizationProgress} className="h-2" />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>{vectorizationStatus.completed} completed</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-yellow-500" />
                  <span>{vectorizationStatus.pending + vectorizationStatus.processing} pending</span>
                </div>
              </div>
            </div>
          )}

          {!alreadyImported && (
            <input
              type="text"
              placeholder="https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/CUAD_v1/CUAD_v1.json"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background"
            />
          )}

          <Button 
            onClick={handleImport} 
            disabled={isImporting || alreadyImported}
            className="w-full"
          >
            {isImporting ? "Importing..." : alreadyImported ? "Already Imported" : "Import CUAD Dataset"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importing CUAD Dataset</DialogTitle>
            <DialogDescription>
              This may take a few minutes. Please don't close this window.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Import Progress</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
            {vectorizationStatus && vectorizationStatus.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Vectorization Progress</span>
                  <span>{vectorizationStatus.completed}/{vectorizationStatus.total}</span>
                </div>
                <Progress value={vectorizationProgress} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
