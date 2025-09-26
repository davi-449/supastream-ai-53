import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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

    const { prompt, chatId } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!chatId || typeof chatId !== 'string') {
      return new Response(JSON.stringify({ error: 'Chat ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Constants for context management
    const MAX_MESSAGES = 12;
    const MAX_CONTEXT_CHARS = 5000;

    // Fetch recent messages for context (max 12 messages = ~6 pairs)
    const { data: recentMessages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(MAX_MESSAGES);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Build contents array with context
    const contents = [];
    
    // Add recent messages as context (reverse to get chronological order)
    if (recentMessages && recentMessages.length > 0) {
      const contextMessages = recentMessages.reverse();
      let totalChars = 0;
      
      for (const message of contextMessages) {
        const role = message.sender === 'user' ? 'user' : 'model';
        const text = message.content;
        
        // Check if adding this message would exceed character limit
        if (totalChars + text.length > MAX_CONTEXT_CHARS) break;
        
        contents.push({
          role,
          parts: [{ text }]
        });
        
        totalChars += text.length;
      }
    }

    // If no context exists, add current user message as fallback
    const truncatedPrompt = prompt.length > 1000 ? prompt.slice(0, 1000) : prompt;
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: truncatedPrompt }]
      });
    }

    const payload = { contents };

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

    // Save only assistant response to database (user message already saved by frontend)
    if (text) {
      await supabase.from('messages').insert({
        chat_id: chatId,
        content: text,
        sender: 'assistant'
      });
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