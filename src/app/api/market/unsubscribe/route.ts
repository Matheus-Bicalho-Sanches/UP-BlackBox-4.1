import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const { ticker } = await request.json();

    if (!ticker) {
      return new Response(JSON.stringify({ error: "ticker is required" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Remove from Firestore
    // O up5-tick-collector monitora esta coleção e faz unsubscribe automaticamente
    await adminDb.collection("activeSubscriptions").doc(ticker.toUpperCase()).delete();

    return new Response(JSON.stringify({ ok: true, message: `Unsubscribed from ${ticker}` }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in /api/market/unsubscribe:", err);
    return new Response(JSON.stringify({ error: err.message || "internal" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 