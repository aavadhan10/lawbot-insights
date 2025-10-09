import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface Finding {
  risk_level: string;
  status: string;
}

interface ReviewSummaryProps {
  findings: Finding[];
  reviewId: string;
}

export default function ReviewSummary({ findings, reviewId }: ReviewSummaryProps) {
  const total = findings.length;
  const highRisk = findings.filter(f => f.risk_level === 'high').length;
  const mediumRisk = findings.filter(f => f.risk_level === 'medium').length;
  const lowRisk = findings.filter(f => f.risk_level === 'low').length;
  const pending = findings.filter(f => f.status === 'pending').length;
  const applied = findings.filter(f => f.status === 'applied').length;
  const dismissed = findings.filter(f => f.status === 'dismissed').length;

  const handleExport = () => {
    // TODO: Implement export functionality
    toast.info("Export functionality coming soon!");
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold mb-1">Review Summary</h3>
            <p className="text-sm text-muted-foreground">
              Found {total} {total === 1 ? 'issue' : 'issues'} requiring attention
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 border rounded-lg">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <p className="text-2xl font-bold">{highRisk}</p>
            <p className="text-xs text-muted-foreground">High Risk</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-warning" />
            <p className="text-2xl font-bold">{mediumRisk}</p>
            <p className="text-xs text-muted-foreground">Medium Risk</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{lowRisk}</p>
            <p className="text-xs text-muted-foreground">Low Risk</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <FileText className="w-8 h-8 mx-auto mb-2" />
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total Issues</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="font-medium text-muted-foreground mb-1">Pending</p>
            <p className="text-xl font-bold">{pending}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground mb-1">Applied</p>
            <p className="text-xl font-bold text-primary">{applied}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground mb-1">Dismissed</p>
            <p className="text-xl font-bold text-muted-foreground">{dismissed}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}