import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Split text into chunks with overlap
function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  // First try splitting by paragraphs
  const paragraphs = text.split(/\n{2,}/);
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((currentChunk + "\n\n" + trimmed).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep overlap from end of previous chunk
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(" ") + "\n\n" + trimmed;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + trimmed : trimmed;
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  // If no good paragraph splits, do character-based splitting
  if (chunks.length === 0 && text.trim().length > 0) {
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + chunkSize).trim());
      i += chunkSize - overlap;
    }
  }

  return chunks.filter(c => c.length > 20); // Skip tiny chunks
}

// Generate embedding using Lovable AI gateway
async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    // Use a model to generate a fixed-size representation
    // We'll use the AI gateway with a tool call to get embeddings
    const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text.slice(0, 2000), // Limit input size
        model: "text-embedding-3-small",
      }),
    });

    if (!response.ok) {
      console.error("Embedding API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    console.error("Embedding error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { document_id, content, title, action } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    if (action === "delete") {
      await sb.from("rag_documents").delete().eq("id", document_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!content || !title) {
      return new Response(JSON.stringify({ error: "content and title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or update document record
    let docId = document_id;
    if (!docId) {
      const { data: doc, error: docErr } = await sb.from("rag_documents").insert({
        title,
        content_preview: content.slice(0, 300),
        status: "processing",
        file_type: "text",
      }).select("id").single();
      if (docErr) throw docErr;
      docId = doc.id;
    } else {
      await sb.from("rag_documents").update({ status: "processing", title, content_preview: content.slice(0, 300) }).eq("id", docId);
      // Clear old chunks
      await sb.from("rag_chunks").delete().eq("document_id", docId);
    }

    // Chunk the content
    const chunks = chunkText(content);

    // Process chunks with embeddings
    let successCount = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (chunk, idx) => {
          const embedding = await generateEmbedding(chunk, apiKey);
          return {
            document_id: docId,
            chunk_index: i + idx,
            content: chunk,
            embedding: embedding ? `[${embedding.join(",")}]` : null,
            metadata: { char_count: chunk.length },
          };
        })
      );

      const validResults = results.filter(r => r.embedding !== null);
      if (validResults.length > 0) {
        const { error: insertErr } = await sb.from("rag_chunks").insert(validResults);
        if (insertErr) console.error("Chunk insert error:", insertErr);
        else successCount += validResults.length;
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Update document status
    await sb.from("rag_documents").update({
      status: successCount > 0 ? "ready" : "failed",
      total_chunks: successCount,
    }).eq("id", docId);

    return new Response(JSON.stringify({
      success: true,
      document_id: docId,
      total_chunks: chunks.length,
      embedded_chunks: successCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-rag-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
