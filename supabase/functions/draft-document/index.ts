import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user and get organization
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth validation failed:', userError);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError || !userRole?.organization_id) {
      return new Response(JSON.stringify({ error: 'User must be assigned to an organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check user rate limit (20 drafts per hour)
    const { data: userRateLimitOk } = await supabase.rpc('check_rate_limit', {
      _user_id: user.id,
      _action_type: 'draft_document',
      _limit: 20,
      _window_minutes: 60
    });

    if (!userRateLimitOk) {
      return new Response(JSON.stringify({ error: 'Personal rate limit exceeded (20/hour). Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check organization rate limit (500 drafts per day)
    const { data: orgRateLimitOk } = await supabase.rpc('check_org_rate_limit', {
      _organization_id: userRole.organization_id,
      _action_type: 'draft_document',
      _limit: 500,
      _window_minutes: 1440 // 24 hours
    });

    if (!orgRateLimitOk) {
      return new Response(JSON.stringify({ error: 'Organization rate limit exceeded (500/day). Please contact your admin.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { prompt, mode, originalContent, documentType } = await req.json();
    
    // Input validation
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid prompt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (prompt.length > 10000) {
      return new Response(JSON.stringify({ error: 'Prompt too long (max 10,000 characters)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (mode === 'redline' && !originalContent) {
      return new Response(JSON.stringify({ error: 'Original content required for redlining' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = mode === 'redline'
      ? `You are a legal document redlining assistant. Make the requested changes to the document and mark them clearly:
- Use [DELETED: text] for removed text
- Use [INSERTED: text] for added text
Return the full revised document with these markers.`
      : `You are a legal document drafting assistant. Generate complete, professional legal documents with proper formatting, clauses, and provisions. Return ONLY the document text, no explanations.`;

    const messages = mode === 'redline'
      ? [{ role: 'user', content: `Original document:\n\n${originalContent}\n\nRedline instructions: ${prompt}\n\nMake the changes and mark them with [DELETED: ] and [INSERTED: ] tags.` }]
      : [{ role: 'user', content: `Draft a ${documentType || 'legal document'}: ${prompt}` }];

    console.log('Calling Lovable AI with mode:', mode);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    console.log('Streaming draft response');

    // Log usage in background (don't await to avoid blocking response)
    supabase.from('usage_logs').insert({
      user_id: user.id,
      organization_id: userRole.organization_id,
      action_type: 'draft_document',
      metadata: {
        mode,
        document_type: documentType,
        prompt_length: prompt.length,
        timestamp: new Date().toISOString()
      }
    }).then(({ error }) => {
      if (error) console.error('Failed to log usage:', error);
    });

    // Return the stream directly
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in draft-document function:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error
    });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});