import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const { ticker, exchange } = await request.json();

    await fetch(process.env.PROFIT_FEED_URL + "/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, exch: exchange }),
    });

    // Persist ticker in Firestore (idempotente)
    await adminDb.collection("activeSubscriptions").doc(ticker).set(
      {
        ticker,
        exchange,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }
} 