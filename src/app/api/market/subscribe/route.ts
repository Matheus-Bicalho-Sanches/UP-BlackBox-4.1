import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const { ticker, exchange } = await request.json();

    if (!ticker || !exchange) {
      return new Response(JSON.stringify({ error: "ticker and exchange are required" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Persist ticker in Firestore (idempotente)
    // O up5-tick-collector monitora esta coleção e faz subscribe automaticamente
    await adminDb.collection("activeSubscriptions").doc(ticker).set(
      {
        ticker: ticker.toUpperCase(),
        exchange: exchange.toUpperCase(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return new Response(JSON.stringify({ ok: true, message: `Subscribed to ${ticker} on ${exchange}` }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in /api/market/subscribe:", err);
    return new Response(JSON.stringify({ error: err.message || "internal" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 