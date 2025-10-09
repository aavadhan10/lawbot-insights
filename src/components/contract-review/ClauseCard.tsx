import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BenchmarkSection from "./BenchmarkSection";

interface Finding {
  id: string;
  clause_title: string;
  clause_text: string;
  risk_level: string;
  issue_description: string;
  recommendation: string;
  original_text: string;
  suggested_text: string;
  benchmark_data: any;
  status: string;
}

interface ClauseCardProps {
  finding: Finding;
  onUpdate: () => void;
}

export default function ClauseCard({ finding, onUpdate }: ClauseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const riskConfig: Record<string, {
    icon: any;
    color: string;
    bgColor: string;
    label: string;
  }> = {
    high: { 
      icon: AlertTriangle, 
      color: 'text-destructive', 
      bgColor: 'bg-destructive/10',
      label: 'HIGH RISK' 
    },
    medium: { 
      icon: AlertTriangle, 
      color: 'text-warning', 
      bgColor: 'bg-warning/10',
      label: 'MEDIUM RISK' 
    },
    low: { 
      icon: AlertTriangle, 
      color: 'text-primary', 
      bgColor: 'bg-primary/10',
      label: 'LOW RISK' 
    }
  };

  const config = riskConfig[finding.risk_level] || riskConfig.low;
  const Icon = config.icon;

  const handleApply = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('clause_findings')
        .update({ status: 'applied' })
        .eq('id', finding.id);

      if (error) throw error;

      toast.success("Recommendation applied");
      onUpdate();
    } catch (error) {
      console.error('Error applying recommendation:', error);
      toast.error("Failed to apply recommendation");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDismiss = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('clause_findings')
        .update({ status: 'dismissed' })
        .eq('id', finding.id);

      if (error) throw error;

      toast.success("Finding dismissed");
      onUpdate();
    } catch (error) {
      console.error('Error dismissing finding:', error);
      toast.error("Failed to dismiss finding");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className={`${finding.status !== 'pending' ? 'opacity-60' : ''}`}>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Icon className={`w-5 h-5 mt-0.5 ${config.color}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{finding.clause_title}</h3>
                <Badge variant="outline" className={config.bgColor}>
                  {config.label}
                </Badge>
                {finding.status !== 'pending' && (
                  <Badge variant={finding.status === 'applied' ? 'default' : 'secondary'}>
                    {finding.status === 'applied' ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1" /> Applied</>
                    ) : (
                      <><XCircle className="w-3 h-3 mr-1" /> Dismissed</>
                    )}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {finding.issue_description}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 flex-shrink-0" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Issue Description</h4>
            <p className="text-sm text-muted-foreground">{finding.issue_description}</p>
          </div>

          <div>
            <h4 className="font-medium mb-2">Recommendation</h4>
            <p className="text-sm text-muted-foreground">{finding.recommendation}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2 text-destructive">Original Text</h4>
              <div className="p-3 bg-destructive/5 rounded border border-destructive/20">
                <p className="text-sm line-through">{finding.original_text}</p>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-primary">Suggested Text</h4>
              <div className="p-3 bg-primary/5 rounded border border-primary/20">
                <p className="text-sm">{finding.suggested_text}</p>
              </div>
            </div>
          </div>

          <BenchmarkSection 
            benchmarkData={finding.benchmark_data}
            findingId={finding.id}
            clauseText={finding.clause_text}
            clauseType={finding.clause_title}
          />

          {finding.status === 'pending' && (
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleApply}
                disabled={isUpdating}
                className="flex-1"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Apply Recommendation
              </Button>
              <Button 
                variant="outline"
                onClick={handleDismiss}
                disabled={isUpdating}
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}