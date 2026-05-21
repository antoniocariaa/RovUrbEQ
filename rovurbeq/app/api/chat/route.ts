// ── POST /api/chat ───────────────────────────────────────────────────────────
// Streaming AI chat powered by Groq. Each request fetches fresh context from
// MongoDB (zones + location stats) and injects it into the system prompt so
// the LLM can answer questions about urban services across Rovereto's zones.

import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Zone } from "@/models/Zone";
import { Location } from "@/models/Location";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── Build context from MongoDB ───────────────────────────────────────────────
async function buildContext(): Promise<string> {
  await connectDB();

  // 1. Get all zones
  const zones = await Zone.find({}).lean();
  const zoneNames = zones.map((z) => z.name).sort();

  // 2. Aggregate location counts per quartiere + category + subcategory
  //    The "quartiere" field on locations is an ObjectId ref to zones
  const pipeline = [
    {
      $group: {
        _id: {
          quartiere: "$quartiere",
          category: "$category",
          subcategory: "$subcategory",
        },
        count: { $sum: 1 },
      },
    },
  ];
  const stats = await Location.aggregate(pipeline);

  // Build a zone-id → name map
  const zoneMap = new Map<string, string>();
  for (const z of zones) {
    zoneMap.set(String(z._id), z.name);
  }

  // Organise stats per zone
  const perZone = new Map<string, { category: string; subcategory: string; count: number }[]>();
  for (const s of stats) {
    const zoneId = String(s._id.quartiere ?? "sconosciuto");
    const zoneName = zoneMap.get(zoneId) ?? "Zona sconosciuta";
    if (!perZone.has(zoneName)) perZone.set(zoneName, []);
    perZone.get(zoneName)!.push({
      category: s._id.category,
      subcategory: s._id.subcategory,
      count: s.count,
    });
  }

  // 3. Also get overall totals per category
  const totalPipeline = [
    {
      $group: {
        _id: { category: "$category", subcategory: "$subcategory" },
        count: { $sum: 1 },
      },
    },
  ];
  const totals = await Location.aggregate(totalPipeline);

  // ── Format context string ──────────────────────────────────────────────────
  let ctx = `## Zone/Quartieri di Rovereto\n`;
  ctx += zoneNames.join(", ") + "\n\n";

  ctx += `## Totali servizi nel comune\n`;
  for (const t of totals) {
    ctx += `- ${t._id.category} > ${t._id.subcategory}: ${t.count}\n`;
  }
  ctx += "\n";

  ctx += `## Dettaglio servizi per quartiere\n`;
  for (const [zoneName, services] of perZone) {
    ctx += `### ${zoneName}\n`;
    for (const s of services) {
      ctx += `- ${s.category} > ${s.subcategory}: ${s.count}\n`;
    }
    ctx += "\n";
  }

  return ctx;
}

// ── System prompt ────────────────────────────────────────────────────────────
function systemPrompt(context: string): string {
  return `Sei un assistente AI esperto di urbanistica e servizi pubblici del Comune di Rovereto (Trentino, Italia).
Il tuo compito è rispondere a domande sui servizi presenti nelle diverse zone/quartieri di Rovereto, basandoti ESCLUSIVAMENTE sui dati reali forniti di seguito.

REGOLE:
- Rispondi SEMPRE in italiano
- Basa le tue risposte solo sui dati forniti, non inventare informazioni
- Se non hai dati sufficienti per rispondere, dillo chiaramente
- Usa un tono professionale ma accessibile
- Quando confronti zone, usa numeri concreti dai dati
- Se l'utente chiede di servizi non presenti nei dati, spiega quali categorie sono disponibili

DATI AGGIORNATI:
${context}

Rispondi in modo conciso e utile.`;
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY non configurata. Aggiungi la chiave nel file .env" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const messages: { role: string; content: string }[] = body.messages ?? [];

  if (!messages.length) {
    return Response.json({ error: "Nessun messaggio fornito" }, { status: 400 });
  }

  try {
    // Build context from DB
    const context = await buildContext();

    // Prepare messages for Groq
    const groqMessages = [
      { role: "system", content: systemPrompt(context) },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Call Groq streaming API
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        stream: true,
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("[api/chat] Groq error:", groqRes.status, errText);
      return Response.json(
        { error: `Errore Groq: ${groqRes.status}` },
        { status: 502 }
      );
    }

    // Stream the response back to the client using Web Streams
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = groqRes.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(data);
                const token = json.choices?.[0]?.delta?.content;
                if (token) {
                  controller.enqueue(encoder.encode(token));
                }
              } catch {
                // skip malformed JSON chunks
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("[api/chat] Error:", err);
    return Response.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
