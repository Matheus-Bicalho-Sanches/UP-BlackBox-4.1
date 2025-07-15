import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const { ticker } = await request.json();

    await fetch(process.env.PROFIT_FEED_URL + "/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });

    // Remove from Firestore
    await adminDb.collection("activeSubscriptions").doc(ticker).delete();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
} 