import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart, ReferenceLine } from "recharts";
import { Download, TrendingUp, Database, FileText } from "lucide-react";
import { toast } from "sonner";

interface DataDashboardProps {
  data: any;
  insights: any;
  visualizations?: any[];
  forecasts?: any[];
}

export const DataDashboard = ({ data, insights, visualizations = [], forecasts = [] }: DataDashboardProps) => {
  const handleExport = () => {
    toast.success("Report exported successfully!");
  };

  // Show first 10 rows
  const previewRows = data.rows.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Rows</p>
              <p className="text-2xl font-bold">{data.rows.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Columns</p>
              <p className="text-2xl font-bold">{data.headers.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">File Size</p>
              <p className="text-2xl font-bold">
                {(new Blob([JSON.stringify(data)]).size / 1024).toFixed(0)}KB
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Data Preview */}
      <Card className="p-6 border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Data Preview</h3>
          <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export to Excel
          </Button>
        </div>
        
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {data.headers.map((header: string, index: number) => (
                  <TableHead key={index}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row: any[], rowIndex: number) => (
                <TableRow key={rowIndex}>
                  {row.map((cell: any, cellIndex: number) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {data.rows.length > 10 && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            Showing 10 of {data.rows.length} rows
          </p>
        )}
      </Card>

      {/* Forecasts */}
      {forecasts.length > 0 && (
        <div className="space-y-6">
          {forecasts.map((forecast, index) => {
            const combinedData = [...forecast.historicalData, ...forecast.forecastData];
            const splitIndex = forecast.historicalData.length;
            
            return (
              <Card key={`forecast-${index}`} className="p-6 border-border/50">
                <div className="space-y-2 mb-4">
                  <h3 className="text-lg font-semibold">{forecast.title}</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Method:</strong> {forecast.method}</p>
                    {forecast.assumptions && <p><strong>Assumptions:</strong> {forecast.assumptions}</p>}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={combinedData}>
                    <defs>
                      <linearGradient id={`historicalGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id={`forecastGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey={forecast.xKey} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                      labelFormatter={(label, payload) => {
                        const dataPoint = payload?.[0];
                        const idx = combinedData.findIndex(d => d[forecast.xKey] === label);
                        return idx >= splitIndex ? `${label} (Forecast)` : `${label} (Historical)`;
                      }}
                    />
                    <ReferenceLine x={forecast.historicalData[forecast.historicalData.length - 1]?.[forecast.xKey]} stroke="hsl(var(--border))" strokeDasharray="5 5" />
                    
                    {/* Historical area */}
                    <Area 
                      type="monotone" 
                      dataKey={forecast.yKey}
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill={`url(#historicalGradient-${index})`}
                      connectNulls={false}
                      data={forecast.historicalData}
                    />
                    
                    {/* Forecast area */}
                    <Area 
                      type="monotone" 
                      dataKey={forecast.yKey}
                      stroke="hsl(var(--accent))" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      fill={`url(#forecastGradient-${index})`}
                      connectNulls={false}
                      data={forecast.forecastData}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-primary"></div>
                    <span>Historical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-accent border-dashed"></div>
                    <span>Forecast</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Visualizations */}
      {visualizations.length > 0 ? (
        <div className="space-y-6">
          {visualizations.map((viz, index) => (
            <Card key={index} className="p-6 border-border/50">
              <h3 className="text-lg font-semibold mb-4">{viz.title}</h3>
              {viz.type === "bar" && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={viz.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey={viz.xKey} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Bar dataKey={viz.yKey} fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {viz.type === "line" && (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={viz.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey={viz.xKey} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey={viz.yKey} 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {viz.type === "area" && (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={viz.data}>
                    <defs>
                      <linearGradient id={`colorArea-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey={viz.xKey} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey={viz.yKey} 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill={`url(#colorArea-${index})`}
                      fillOpacity={1}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 border-border/50">
          <h3 className="text-lg font-semibold mb-4">Visualizations</h3>
          <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg border border-dashed border-border">
            <div className="text-center space-y-2">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">
                Ask the AI to create charts and visualizations
              </p>
              <p className="text-xs text-muted-foreground">
                Try: "Create a bar chart showing the top 5 values" or "Forecast next 3 months"
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
