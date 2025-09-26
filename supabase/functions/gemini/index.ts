import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    // Health check: GET /functions/v1/gemini
    if (req.method === 'GET') {
      if (!geminiApiKey) {
        return new Response(JSON.stringify({ enabled: false, error: 'GEMINI_API_KEY missing' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ enabled: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY missing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const truncated = prompt.length > 5000 ? prompt.slice(0, 5000) : prompt;

    const payload = {
      // minimal request shape that matches the generativelanguage examples
      contents: [
        {
          parts: [
            {
              text: truncated,
            },
          ],
        },
      ],
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${encodeURIComponent(
      geminiApiKey
    )}`;

    console.log('Making request to Gemini API...');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const out = await response.json();
    console.log('Gemini API response status:', response.status);
    
    if (!response.ok) {
      console.error('Gemini API error:', out);
      return new Response(JSON.stringify({ error: out.error?.message || 'Gemini API error', raw: out }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to extract the main text from known response shapes
    let text = null;
    try {
      const cand = out?.candidates?.[0];
      if (cand && cand.content && Array.isArray(cand.content.parts) && cand.content.parts[0]?.text) {
        text = cand.content.parts[0].text;
      } else if (out?.output && Array.isArray(out.output) && out.output[0]?.content?.[0]?.text) {
        text = out.output[0].content[0].text;
      }
    } catch (e) {
      console.warn('Error parsing Gemini response:', e);
      // ignore parse errors
    }

    console.log('Gemini API success, text length:', text?.length || 0);
    return new Response(JSON.stringify({ ok: true, text, raw: out }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unexpected error in Gemini function:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});