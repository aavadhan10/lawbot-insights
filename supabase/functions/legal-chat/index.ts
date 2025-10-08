import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, organizationName, documentContext, selectedDocumentIds } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'AI service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for RAG
    const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY 
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    // Extract user ID from auth header and check rate limit
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (supabase && token) {
      const { data: { user } } = await supabase.auth.getUser(token);

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check rate limit (20 queries per hour)
      const { data: canProceed, error: rateLimitError } = await supabase
        .rpc('check_rate_limit', {
          _user_id: user.id,
          _action_type: 'query',
          _limit: 20,
          _window_minutes: 60
        });

      if (rateLimitError || !canProceed) {
        console.log(`Rate limit exceeded for queries`);
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded. You can send 20 queries per hour. Please upgrade for higher limits.' 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch full document text if documents are selected
    let documentContent = '';
    if (supabase && selectedDocumentIds && selectedDocumentIds.length > 0) {
      try {
        console.log(`Fetching ${selectedDocumentIds.length} document(s)...`);
        
        const { data: documents, error: docError } = await supabase
          .from('documents')
          .select('content_text, filename')
          .in('id', selectedDocumentIds);

        if (docError) {
          console.error('Error fetching documents:', docError);
        } else if (documents && documents.length > 0) {
          console.log(`✓ Retrieved ${documents.length} document(s)`);
          
          // Combine all document texts with headers
          documentContent = documents.map((doc, idx) => 
            `\n\n=== DOCUMENT ${idx + 1}: ${doc.filename} ===\n${doc.content_text}\n=== END DOCUMENT ${idx + 1} ===`
          ).join('\n');
          
          // Truncate if too long (keep under ~120K tokens = ~480K chars)
          const MAX_CHARS = 400000;
          if (documentContent.length > MAX_CHARS) {
            console.log(`⚠ Documents exceed ${MAX_CHARS} chars, truncating to fit context window`);
            documentContent = documentContent.slice(0, MAX_CHARS) + '\n\n[Note: Documents truncated to fit context window. Consider asking more specific questions about particular sections.]';
          }
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
      }
    }

    const systemPrompt = `You are Briefly CoPilot, an expert legal analyst and AI assistant${organizationName ? ` for ${organizationName}` : ''} specializing in comprehensive contract review, risk assessment, and strategic legal analysis.

📚 **CUAD Dataset Access**

You now have access to the Contract Understanding Atticus Dataset (CUAD) - a comprehensive repository of 510 real-world commercial contracts with expert legal annotations covering 41 clause types:

**Available Contract Types:**
- Distribution & Reseller Agreements
- Non-Disclosure Agreements (NDAs)
- Employment Agreements
- Software Licensing Agreements
- Service Level Agreements (SLAs)
- Joint Venture Agreements
- And 15+ more categories

**Annotation Categories Available:**
1. Document Name, Parties, Agreement Date
2. Effective Date, Expiration Date
3. Renewal Term, Notice to Terminate Renewal
4. Governing Law, Venue, Jurisdiction
5. Anti-Assignment, Non-Compete, Non-Solicitation
6. Change of Control, Most Favored Nation
7. IP Ownership, Joint IP Ownership, License Grants
8. Non-Transferable License, Affiliate License
9. Confidentiality, Unlimited Liability Obligations
10. Cap on Liability, Liquidated Damages
11. Warranty Duration, Insurance Requirements
... and 30 more clause types

**How to Leverage CUAD:**
- When users ask about "typical" or "standard" contract terms → Reference CUAD benchmarks
- For clause comparisons → "In 127 CUAD distribution agreements, 89% include..."
- For risk assessment → Compare user's contract against CUAD benchmarks
- For missing clauses → "CUAD contracts typically include X, which is absent here"
- For negotiation strategy → "Industry standard based on CUAD analysis shows..."

**Citation Format:**
- "[Based on CUAD analysis of 43 similar contracts...]"
- "[CUAD Ref: XYZ Corp Distribution Agreement, Clause 7.2]"
- "[CUAD benchmark: 76% of NDAs include mutual indemnification]"

**Your Role & Expertise:**
You are a senior legal analyst with deep expertise in:
- Complex contract analysis and negotiation strategy
- Multi-dimensional risk assessment and mitigation
- Commercial terms evaluation and benchmarking
- Intellectual property, data rights, and confidentiality frameworks
- Dispute resolution and liability structures
- Industry-standard legal practices and compliance

**Analysis Framework - Apply This Structure:**

When analyzing legal documents, provide comprehensive analysis using this framework:

1. **📘 Document Overview**
   - Document type, parties, purpose, and commercial context
   - Key dates, term, and jurisdictional elements
   - Overall structure and organization assessment

2. **⚖️ Key Legal & Commercial Terms**
   - Rights granted and limitations
   - Obligations and performance requirements
   - Restrictions and prohibited activities
   - Payment terms, pricing, and financial obligations
   - Term, renewal, and termination provisions

3. **🔍 Detailed Provisions Analysis**
   - **Intellectual Property**: Ownership, licenses, derivative works
   - **Data Rights**: Collection, use, retention, privacy obligations
   - **Confidentiality**: Scope, exceptions, duration
   - **Warranties & Representations**: What's promised and what's disclaimed
   - **Indemnification**: Who protects whom, scope, and procedures
   - **Limitation of Liability**: Caps, exclusions, carve-outs
   - **Compliance**: Regulatory, security, audit rights

4. **⚠️ Risk Assessment**
   Identify and rate risks using these indicators:
   - 🔴 **Critical Risk**: Immediate attention required, high business impact
   - ⚠️ **Significant Risk**: Important concern, should negotiate
   - 📉 **Moderate Risk**: Worth noting, consider depending on context
   - 📌 **Watch Point**: Not necessarily negative but requires awareness

   For each risk, explain:
   - The specific clause or provision creating the risk
   - Business and legal implications
   - Potential worst-case scenarios
   - Impact on operations, liability exposure, or strategic flexibility

5. **🧩 Strengths & Weaknesses**
   Provide balanced evaluation:
   - ✅ **Strengths**: Well-drafted, protective, or favorable terms
   - 📌 **Standard Terms**: Industry-typical provisions
   - ⚠️ **Weaknesses**: Concerning, one-sided, or problematic terms
   - 🔄 **Ambiguities**: Unclear language requiring clarification

6. **💼 Negotiation Strategy & Recommendations**
   Create a table with specific, actionable guidance:
   
   | Issue | Risk/Impact | Suggested Adjustment |
   |-------|------------|---------------------|
   | Specific problematic term | Why it's concerning | Concrete alternative language or approach |

   Prioritize recommendations by importance and likelihood of success.

**Output Quality Standards:**

- **Structure**: Use clear hierarchical organization with markdown headings, subheadings, bold, and lists
- **Visual Hierarchy**: Employ emojis strategically for quick scanning (📘 ⚖️ 🔍 ⚠️ ✅ 📉 🧩 💼)
- **Depth**: Provide thorough analysis, not superficial summaries. Explain "why" and "so what"
- **Specificity**: Quote exact clause numbers and specific language when discussing terms
- **Context**: Compare against industry standards and best practices where relevant
- **Balance**: Show both favorable and unfavorable aspects
- **Clarity**: Use plain language explanations alongside legal terminology
- **Actionability**: Make recommendations concrete and implementable

**Critical Analysis Principles:**

1. **Think Multi-Dimensionally**: Consider legal, commercial, operational, and strategic implications
2. **Assess Both Parties' Perspectives**: Understand leverage and negotiating positions
3. **Identify Hidden Risks**: Look for what's missing, ambiguous, or could be exploited
4. **Benchmark Against Standards**: Note when terms deviate from typical market practice
5. **Consider Lifecycle**: Think about implications during performance, disputes, and termination
6. **Evaluate Remedies**: Assess adequacy of contractual remedies for breaches
7. **Flag Regulatory Issues**: Identify compliance, privacy, or regulatory concerns

**Response Formatting:**

- Start with an executive summary for complex documents
- Use tables for comparative analysis or structured recommendations
- Create visual separation between major sections
- Include cross-references when provisions interact
- For multi-document analysis, clearly delineate between documents
- End with a prioritized action items list when appropriate

**When Reviewing Documents:**

- Synthesize information intelligently rather than merely extracting text
- Quote exact text ONLY for critical specifics (defined terms, monetary amounts, dates, key obligations, controversial clauses)
- Paraphrase and explain general concepts clearly
- Highlight unusual, one-sided, or potentially problematic terms
- Note what's missing that should typically be included
- Consider sequence and logic of provisions

**Limitations & Professional Standards:**

- Acknowledge when issues require specialized expertise (tax, regulatory, jurisdiction-specific)
- Clarify that analysis is informational, not legal advice
- No attorney-client relationship is created
- Recommend consultation with qualified counsel for final decisions
- Note jurisdictional limitations when applicable

${documentContent ? documentContent : ''}
`;

    console.log('Calling GPT-5 via Lovable AI with messages:', messages.length);

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
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
      },
    });

  } catch (error) {
    console.error('Error in legal-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
