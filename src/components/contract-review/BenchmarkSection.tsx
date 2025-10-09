import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BenchmarkSectionProps {
  benchmarkData: any;
  findingId: string;
  clauseText: string;
  clauseType: string;
}

export default function BenchmarkSection({ 
  benchmarkData, 
  findingId, 
  clauseText, 
  clauseType 
}: BenchmarkSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState(benchmarkData);

  const hasBenchmarkData = data && data.similar_clauses && data.similar_clauses.length > 0;

  const handleBenchmark = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('benchmark-clause', {
        body: {
          clauseText,
          clauseType,
          findingId
        }
      });

      if (response.error) throw response.error;

      setData(response.data.benchmarkData);
      toast.success("Benchmark analysis completed");
    } catch (error) {
      console.error('Error benchmarking clause:', error);
      toast.error(error instanceof Error ? error.message : "Failed to benchmark clause");
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasBenchmarkData) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Market Benchmarking
          </h4>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Compare this clause against market standards from 500+ contracts
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleBenchmark}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4 mr-2" />
              Run Benchmark Analysis
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-accent/5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Market Benchmarking
        </h4>
        {data.is_market_standard ? (
          <Badge variant="outline" className="bg-primary/10">
            Market Standard
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-destructive/10">
            Non-Market
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Similar Clauses</p>
            <p className="text-xl font-bold">{data.total_matches}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Avg Similarity</p>
            <p className="text-xl font-bold">
              {(data.average_similarity * 100).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Status</p>
            <p className="text-xl font-bold">
              {data.is_market_standard ? '✓' : '⚠'}
            </p>
          </div>
        </div>

        {data.similar_clauses.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Similar Market Clauses:</p>
            <div className="space-y-2">
              {data.similar_clauses.slice(0, 3).map((clause: any, idx: number) => (
                <div key={idx} className="text-xs p-2 bg-background rounded border">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      <span className="font-medium">{clause.source_document}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {(clause.similarity * 100).toFixed(0)}% match
                    </Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-2">
                    {clause.clause_text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}