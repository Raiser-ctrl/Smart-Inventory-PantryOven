import { NextRequest, NextResponse } from "next/server";
import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ML_API_URL = process.env.ML_API_URL ?? "http://127.0.0.1:8000";
const MAX_BODY_BYTES = 24000;
const responseHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status, headers: responseHeaders });
}
type Message = { role: "user" | "assistant"; content: string };
type ChatContext = "general" | "advice" | "ideas" | "shopping" | "waste";
type ChatRequest = { message: string; history: Message[]; context?: ChatContext };
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validBody(value: unknown): value is ChatRequest {
  return isRecord(value) && Object.keys(value).every(k => ["message", "history", "context"].includes(k)) &&
    (value.context === undefined || (typeof value.context === "string" && ["general", "advice", "ideas", "shopping", "waste"].includes(value.context))) &&
    typeof value.message === "string" && value.message.trim().length > 0 && value.message.length <= 1000 &&
    Array.isArray(value.history) && value.history.length <= 8 && value.history.every(m =>
      isRecord(m) && Object.keys(m).every(k => ["role", "content"].includes(k)) &&
      (m.role === "user" || m.role === "assistant") && typeof m.content === "string" &&
      m.content.length > 0 && m.content.length <= 1500);
}
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const auth = await verifyApiStaff();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    // 2. Origin verification
    const configuredOrigin =
      process.env.APP_ORIGIN ??
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "");

    let allowedOrigin: string;

    try {
      const url = new URL(configuredOrigin);

      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error("Invalid origin");
      }

      allowedOrigin = url.origin;
    } catch {
      return jsonError("Konfigurasi APP_ORIGIN tidak valid.", 500);
    }

    if (request.headers.get("origin") !== allowedOrigin) {
      return jsonError("Origin request tidak diizinkan.", 403);
    }

    // 3. Content-Type
    const contentType =
      request.headers.get("content-type") ?? "";

    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return jsonError(
        "Content-Type harus application/json.",
        415
      );
    }

    // 4. Body validation
    const declaredLength = Number(
      request.headers.get("content-length")
    );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_BODY_BYTES
    ) {
      return jsonError("Ukuran request terlalu besar.", 413);
    }

    const rawBody = await request.text();

    if (
      new TextEncoder().encode(rawBody).byteLength >
      MAX_BODY_BYTES
    ) {
      return jsonError("Ukuran request terlalu besar.", 413);
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError("Format JSON tidak valid.", 400);
    }

    if (!validBody(body)) return jsonError("Pesan atau riwayat percakapan tidak valid.", 400);

    // Inventory comes from the authenticated server, never the browser's chat history.
    const { data, error } = await supabaseAdmin.from("inventory_current_stock")
      .select("id, name, unit, current_stock, minimum_stock")
      .is("archived_at", null).order("id").limit(201);
    const inventory = (data ?? []).slice(0, 200).map(item => ({
      id: item.id, name: item.name, unit: item.unit,
      current_stock: Number(item.current_stock), minimum_stock: Number(item.minimum_stock),
    }));
    const inventoryValid = !error && inventory.every(item =>
      typeof item.id === "string" && typeof item.name === "string" && item.name.length <= 150 &&
      typeof item.unit === "string" && item.unit.length <= 30 &&
      Number.isFinite(item.current_stock) && item.current_stock >= 0 &&
      Number.isFinite(item.minimum_stock) && item.minimum_stock >= 0);
    // General bakery chat remains available when inventory cannot be read.
    const response = await fetch(`${ML_API_URL}/rag/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: body.message.trim(), history: body.history, context: body.context ?? "general",
        inventory: inventoryValid ? inventory : [],
        inventory_status: !inventoryValid ? "unavailable" : (data?.length ?? 0) > 200 ? "partial" : "complete",
      }),
      cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(90000)]),
    });
    if (!response.ok) return jsonError("Bready belum bisa menjawab. Coba lagi sebentar, ya.", 502);
    const answer: unknown = await response.json();
    if (!isRecord(answer) || typeof answer.answer !== "string" || !answer.answer.trim() ||
        answer.answer.length > 12000 || ![null, "predict", "rag"].includes(answer.action as null | string) ||
        !(answer.item_id === null || (typeof answer.item_id === "string" && inventoryValid && inventory.some(i => i.id === answer.item_id))) ||
        !(answer.lead_time_days === null || (typeof answer.lead_time_days === "number" && Number.isInteger(answer.lead_time_days) && answer.lead_time_days >= 1 && answer.lead_time_days <= 365))) {
      return jsonError("Format jawaban Bready tidak valid. Silakan coba lagi.", 502);
    }
    if (body.context && body.context !== "general") {
      answer.action = null;
      answer.item_id = null;
      answer.lead_time_days = null;
    }
    return NextResponse.json({ success: true, data: answer }, { headers: responseHeaders });
  } catch (error) {
    console.error("Bready chat request failed:", error instanceof Error ? error.name : "UnknownError");
    return jsonError("Bready belum dapat dihubungi. Pastikan backend aktif lalu coba lagi.", 503);
  }
}
