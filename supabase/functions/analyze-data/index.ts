import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, dataContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create system prompt with data context
    const systemPrompt = `You are an AI data analyst assistant for a law firm backoffice. You help analyze CSV data and provide insights.

Current dataset information:
- Filename: ${dataContext.filename}
- Total rows: ${dataContext.rowCount}
- Columns: ${dataContext.headers.join(", ")}
- Sample data (first 5 rows): ${JSON.stringify(dataContext.sampleData)}

Your capabilities:
1. Analyze data patterns and trends
2. Generate statistical insights
3. Create visualizations using the create_visualization tool
4. Identify anomalies or interesting findings
5. Answer specific questions about the data
6. **Forecast and predict future values** using the create_forecast tool

When users ask for visualizations or charts, use the create_visualization tool to generate them. You can create:
- Bar charts for comparing categories
- Line charts for trends over time
- Pie charts for proportions
- Area charts for cumulative data

When users ask for forecasts or predictions:
- Use the create_forecast tool to generate forecasts
- Analyze historical trends and patterns in the data
- Use methods like moving averages, linear regression, or trend extrapolation
- Always explain your forecasting method and assumptions
- Include confidence levels or ranges when possible
- Clearly distinguish forecasted values from historical data
- Warn about limitations (e.g., "assumes current trends continue", "external factors not considered")

Provide clear, conversational insights like ChatGPT. Be friendly and helpful.`;

    console.log("Calling Lovable AI with data context:", dataContext.filename);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_visualization",
              description: "Create a data visualization chart. Use this when users ask for charts, graphs, or visualizations.",
              parameters: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["bar", "line", "pie", "area"],
                    description: "Type of chart to create"
                  },
                  title: {
                    type: "string",
                    description: "Title for the chart"
                  },
                  data: {
                    type: "array",
                    description: "Array of data points for the chart",
                    items: {
                      type: "object"
                    }
                  },
                  xKey: {
                    type: "string",
                    description: "Key for x-axis data"
                  },
                  yKey: {
                    type: "string",
                    description: "Key for y-axis data"
                  }
                },
                required: ["type", "title", "data", "xKey", "yKey"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_forecast",
              description: "Create a forecast or prediction based on historical data. Use this when users ask to predict, forecast, or project future values.",
              parameters: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Title for the forecast"
                  },
                  historicalData: {
                    type: "array",
                    description: "Historical data points",
                    items: {
                      type: "object"
                    }
                  },
                  forecastData: {
                    type: "array",
                    description: "Forecasted data points",
                    items: {
                      type: "object"
                    }
                  },
                  xKey: {
                    type: "string",
                    description: "Key for x-axis (time period)"
                  },
                  yKey: {
                    type: "string",
                    description: "Key for y-axis (forecasted value)"
                  },
                  method: {
                    type: "string",
                    description: "Forecasting method used (e.g., 'linear regression', 'moving average', 'trend extrapolation')"
                  },
                  assumptions: {
                    type: "string",
                    description: "Key assumptions made in the forecast"
                  }
                },
                required: ["title", "historicalData", "forecastData", "xKey", "yKey", "method"]
              }
            }
          }
        ],
        tool_choice: "auto",
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return the streaming response
    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in analyze-data function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
