
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  PackageSearch,
  ChartNoAxesCombined,
  Lightbulb,
  X,
  Search,
} from "lucide-react";

import BreadyMascot from "./BreadyMascot";
import BreadyMessage, {
  type BreadyChatMessage,
} from "./BreadyMessage";

type Props = {
  onClose: () => void;
};

type Item = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
};

type Mode = "predict" | "rag";
type ChatContext = "general" | "advice" | "ideas" | "shopping" | "waste";
const ADVICE_OPTIONS = [
  { context: "ideas", label: "Ide Olahan", description: "Temukan ide dari bahan yang tersedia", question: "Beri aku ide olahan bakery dari stok saat ini. Pisahkan bahan yang tersedia dan bahan tambahan yang perlu disiapkan." },
  { context: "shopping", label: "Prioritas Belanja", description: "Tentukan bahan yang perlu diperhatikan", question: "Bantu susun prioritas belanja berdasarkan stok dan batas minimum saat ini. Tanyakan rencana produksi sebelum menentukan jumlah belanja." },
  { context: "waste", label: "Kurangi Waste", description: "Rencanakan pemanfaatan bahan", question: "Bantu kurangi bahan terbuang. Tanyakan bahan yang ingin diprioritaskan dan kondisinya; jangan menganggap ada bahan yang hampir kedaluwarsa tanpa informasi." },
] as const;

type Step =
  | { kind: "item"; mode: Mode }
  | { kind: "lead-time"; mode: Mode; item: Item }
  | null;

type Envelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type Prediction = {
  item: {
    name: string;
    unit: string;
  };
  features: {
    current_stock: number;
    minimum_stock: number;
    average_daily_usage: number;
    average_daily_waste: number;
    lead_time_days: number;
  };
  prediction: {
    stock_status: "Restock" | "Sufficient" | "Excess";
    confidence: number;
    safety_override: boolean;
    dataset_type: string;
  };
  data_quality: {
    level: "insufficient" | "limited" | "adequate";
    limited_history_warning: string | null;
  };
};

type ChatReply = {
  answer: string;
  action: Mode | null;
  item_id: string | null;
  lead_time_days: number | null;
};

type Recommendation = {
  item: {
    name: string;
    unit: string;
  };
  summary: string;
  data_quality: string;
};

const LEAD_TIME_OPTIONS = [1, 3, 7, 14];

const formatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const fmt = (value: number) => formatter.format(value);

function makeMessage(
  role: "assistant" | "user",
  content: string
): BreadyChatMessage {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random()}`,
    role,
    content,
  };
}

function parseItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) {
    throw new Error("Format daftar inventory tidak valid.");
  }

  return raw.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry)
    ) {
      throw new Error("Format item tidak valid.");
    }

    const value = entry as Record<string, unknown>;
    const current = Number(value.current_stock);
    const minimum = Number(value.minimum_stock);

    if (
      typeof value.id !== "string" ||
      typeof value.name !== "string" ||
      typeof value.unit !== "string" ||
      typeof value.category !== "string" ||
      !Number.isFinite(current) ||
      !Number.isFinite(minimum) ||
      current < 0 ||
      minimum < 0
    ) {
      throw new Error("Terdapat data inventory yang tidak valid.");
    }

    return {
      id: value.id,
      name: value.name,
      unit: value.unit,
      category: value.category,
      current_stock: current,
      minimum_stock: minimum,
    };
  });
}

async function requestApi<T>(
  url: string,
  signal: AbortSignal,
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: body
      ? { "Content-Type": "application/json" }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const result = (await response.json()) as Envelope<T>;

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message ||
        `Permintaan gagal (${response.status}).`
    );
  }

  if (result.data === undefined) {
    throw new Error("Data respons API tidak tersedia.");
  }

  return result.data;
}

function stockSummary(items: Item[]) {
  if (!items.length) {
    return "Sepertinya inventory kita masih kosong. Tambahkan bahan dulu, ya.";
  }

  const lowStock = items.filter(
    (item) => item.current_stock <= item.minimum_stock
  );

  if (!lowStock.length) {
    return [
      `Aku sudah cek ${items.length} item di inventory.`,
      "Kabar baik, semuanya masih berada di atas batas stok minimum.",
      "Tetap pantau pemakaian bahan supaya kita bisa tahu kapan perlu belanja lagi.",
    ].join("\n\n");
  }

  const details = lowStock
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.name}: ${fmt(item.current_stock)} ${item.unit}, minimum ${fmt(item.minimum_stock)} ${item.unit}`
    )
    .join("\n");

  return [
    `Aku sudah cek ${items.length} item di inventory. Ada ${lowStock.length} yang perlu kita perhatikan.`,
    details,
    lowStock.length > 8
      ? `Masih ada ${lowStock.length - 8} item lainnya yang perlu dicek.`
      : "",
    "Sebaiknya cek kebutuhan produksi sebelum menentukan jumlah belanja berikutnya.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatPrediction(data: Prediction, days: number) {
  const { item, features, prediction, data_quality } = data;

  let opening = "";
  let advice = "";

  if (prediction.stock_status === "Restock") {
    opening = `Sepertinya stok ${item.name} perlu segera diperhatikan.`;
    advice =
      "Sebaiknya cek kebutuhan produksi dan mulai pertimbangkan pemesanan berikutnya.";
  } else if (prediction.stock_status === "Excess") {
    opening = `Stok ${item.name} terlihat cukup banyak saat ini.`;
    advice =
      "Untuk sementara, pantau pemakaiannya supaya bahan tidak menumpuk terlalu lama.";
  } else {
    opening = `Untuk sekarang, stok ${item.name} masih terlihat cukup.`;
    advice =
      "Belum ada indikasi mendesak untuk restock, tetapi tetap pantau pemakaian hariannya.";
  }

  const qualityWarning =
    data_quality.level === "adequate"
      ? "Hasil ini tetap berupa perkiraan, jadi sesuaikan dengan kebutuhan produksi sebenarnya."
      : "Riwayat pemakaian masih terbatas. Jadi, jangan jadikan prediksi ini satu-satunya dasar untuk menentukan pembelian.";

  return [
    opening,
    `Saat ini tersedia ${fmt(features.current_stock)} ${item.unit}, sedangkan batas minimumnya ${fmt(features.minimum_stock)} ${item.unit}.`,
    advice,
    `Aku menggunakan waktu tunggu supplier ${days} hari untuk pengecekan ini.`,
    prediction.safety_override
      ? "Karena stok sudah mencapai batas minimum, sistem memprioritaskan status restock."
      : "",
    `Catatan: ${qualityWarning}`,
    data_quality.limited_history_warning ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatRagForChat(summary: string) {
  return summary
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(
      /^\s*\d+\.\s*(Ringkasan|Rekomendasi|Referensi)\s*$/gim,
      ""
    )
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function BreadyChatPanel({
  onClose,
}: Props) {
  const [messages, setMessages] = useState<
    BreadyChatMessage[]
  >([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hai! Aku Bready. Kamu bisa tanya soal stok, resep, bahan, atau teknik baking. Mau mulai dari apa?",
    },
  ]);

  const [items, setItems] = useState<Item[]>([]);
  const [inventoryReady, setInventoryReady] =
    useState(false);
  const [step, setStep] = useState<Step>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdvice, setShowAdvice] = useState(false);
  const [chatContext, setChatContext] = useState<ChatContext>("general");
  const contextRef = useRef<ChatContext>("general");

  function changeContext(context: ChatContext) {
    contextRef.current = context;
    setChatContext(context);
  }

  function startAdvice() {
    if (busy.current) return;
    updateStep(null);
    setSearch("");
    changeContext("advice");
    setShowAdvice(true);
    say("user", "Minta Saran");
    say("assistant", "Mau cari ide olahan dari stok, menyusun prioritas belanja, atau mengurangi bahan terbuang? Pilih di bawah atau ceritakan kebutuhanmu langsung.");
    inputRef.current?.focus();
  }

  function leaveAdvice() {
    if (busy.current) return;
    changeContext("general");
    setShowAdvice(false);
    updateStep(null);
    setSearch("");
    inputRef.current?.focus();
  }

  const mounted = useRef(false);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const initialController = useRef<AbortController | null>(
    null
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Item[]>([]);
  const stepRef = useRef<Step>(null);
  const messagesRef = useRef<BreadyChatMessage[]>(messages);
  const [loadingText, setLoadingText] = useState("Bready sedang memeriksa...");

  function updateStep(next: Step) {
    stepRef.current = next;
    setStep(next);
  }

  function say(
    role: "assistant" | "user",
    content: string
  ) {
    if (!mounted.current) return;

    const next = [...messagesRef.current, makeMessage(role, content)];
    messagesRef.current = next;
    setMessages(next);
  }

  useEffect(() => {
    mounted.current = true;
    inputRef.current?.focus();

    const abort = new AbortController();
    initialController.current = abort;

    void (async () => {
      try {
        const raw = await requestApi<unknown>(
          "/api/v1/items",
          abort.signal
        );

        const parsed = parseItems(raw);

        if (!abort.signal.aborted && mounted.current) {
          itemsRef.current = parsed;
          setItems(parsed);
          setInventoryReady(true);
        }
      } catch {
        // Pengguna masih bisa mencoba memuat ulang
        // inventory melalui tombol fitur.
      }
    })();

    return () => {
      mounted.current = false;
      abort.abort();
      controller.current?.abort();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "auto",
      block: "end",
    });
  }, [messages, loading, step, showAdvice]);

  async function runTask(
    task: (signal: AbortSignal) => Promise<void>,
    label = "Bready sedang memeriksa..."
  ) {
    if (busy.current) return;

    busy.current = true;
    setLoadingText(label);
    setLoading(true);

    const abort = new AbortController();
    controller.current = abort;

    try {
      await task(abort.signal);
    } catch (error) {
      if (!abort.signal.aborted) {
        say(
          "assistant",
          error instanceof Error
            ? error.message
            : "Ada kendala saat memproses permintaan. Coba lagi sebentar, ya."
        );
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
      }

      busy.current = false;

      if (mounted.current) {
        setLoading(false);
      }
    }
  }

  async function getItems(
    signal: AbortSignal
  ): Promise<Item[]> {
    initialController.current?.abort();
    const raw = await requestApi<unknown>(
      "/api/v1/items",
      signal
    );

    const parsed = parseItems(raw);

    if (mounted.current) {
      itemsRef.current = parsed;
      setItems(parsed);
      setInventoryReady(true);
    }

    return parsed;
  }

  function checkStock() {
    if (busy.current) return;
    changeContext("general");
    setShowAdvice(false);

    updateStep(null);
    setSearch("");

    say("user", "Cek Stok");

    void runTask(async (signal) => {
      const available = await getItems(signal);
      say("assistant", stockSummary(available));
    });
  }

  function startMode(mode: Mode) {
    if (busy.current) return;
    changeContext("general");
    setShowAdvice(false);

    setSearch("");

    say(
      "user",
      mode === "predict"
        ? "Cek Kebutuhan"
        : "Minta Saran"
    );

    updateStep({ kind: "item", mode });

    say(
      "assistant",
      mode === "predict"
        ? "Oke! Bahan apa yang mau kita cek kebutuhannya?"
        : "Boleh! Mau aku bantu cari saran untuk bahan apa?"
    );

    if (!inventoryReady) {
      void runTask(async (signal) => {
        await getItems(signal);
      });
    }

    inputRef.current?.focus();
  }

  function chooseItem(item: Item) {
    if (busy.current) return;

    const active = stepRef.current;

    if (!active || active.kind !== "item") return;

    say("user", item.name);

    setSearch("");

    updateStep({
      kind: "lead-time",
      mode: active.mode,
      item,
    });

    say(
      "assistant",
      `${item.name}, siap. Biasanya perlu berapa hari sampai bahan dari supplier datang?`
    );
  }

  function chooseDays(days: number) {
    if (busy.current) return;

    const active = stepRef.current;

    if (!active || active.kind !== "lead-time") return;

    say("user", `${days} hari`);

    void generate(active.mode, active.item, days);
  }

  async function generate(
    mode: Mode,
    item: Item,
    days: number
  ) {
    updateStep(null);

    await runTask(async (signal) => {
      if (mode === "predict") {
        const data = await requestApi<Prediction>(
          "/api/v1/ai/predict",
          signal,
          {
            item_id: item.id,
            lead_time_days: days,
          }
        );

        say(
          "assistant",
          formatPrediction(data, days)
        );
      } else {
        const data = await requestApi<Recommendation>(
          "/api/v1/ai/rag",
          signal,
          {
            item_id: item.id,
            lead_time_days: days,
          }
        );

        say(
          "assistant",
          [
            `Aku sudah cek kondisi ${data.item.name}.`,
            formatRagForChat(data.summary),
            data.data_quality !== "adequate"
              ? "Catatan: riwayat pemakaian masih terbatas. Sebaiknya cocokkan saran ini dengan kebutuhan produksi sebenarnya."
              : "",
          ]
            .filter(Boolean)
            .join("\n\n")
        );
      }
    });
  }

  async function askBready(question: string, context: ChatContext = contextRef.current) {
    if (busy.current) return;
    changeContext(context);
    setShowAdvice(false);
    // Snapshot before the new user message so the current question isn't duplicated.
    const history = messagesRef.current.filter(m => m.id !== "welcome")
      .slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 1500) }));
    say("user", question);
    setInput("");
    updateStep(null);
    setSearch("");
    let nextPrediction: { mode: Mode; item: Item; days: number } | null = null;
    await runTask(async (signal) => {
      const data = await requestApi<ChatReply>("/api/v1/ai/chat", signal, {
        message: question, history, context,
      });
      if (typeof data.answer !== "string" || !data.answer.trim()) {
        throw new Error("Jawaban Bready belum tersedia. Coba lagi, ya.");
      }
      say("assistant", data.answer);
      if (context === "general" && (data.action === "predict" || data.action === "rag")) {
        const available = await getItems(signal);
        if (!available.length) {
          say("assistant", "Belum ada bahan aktif. Tambahkan bahan di Inventory terlebih dahulu.");
          return;
        }
        const selected = available.find(i => i.id === data.item_id);
        if (!selected) {
          updateStep({ kind: "item", mode: data.action });
          say("assistant", "Pilih bahan yang ingin dianalisis dari daftar berikut.");
        } else if (data.lead_time_days !== null && Number.isInteger(data.lead_time_days) &&
                   data.lead_time_days >= 1 && data.lead_time_days <= 365) {
          nextPrediction = { mode: data.action, item: selected, days: data.lead_time_days };
        } else {
          updateStep({ kind: "lead-time", mode: data.action, item: selected });
          say("assistant", `Berapa hari waktu tunggu supplier untuk ${selected.name}?`);
        }
      }
    }, "Bready sedang menyusun jawaban...");
    // Run only after runTask releases the duplicate-submit lock.
    if (mounted.current && nextPrediction) {
      const next = nextPrediction as { mode: Mode; item: Item; days: number };
      await generate(next.mode, next.item, next.days);
    }
  }

  function submitText(text: string) {
    const question = text.trim();

    if (!question || busy.current) return;

    const active = stepRef.current;
    if (!active && !/^(batal|cancel|stop)$/i.test(question)) {
      void askBready(question);
      return;
    }
    say("user", question);
    setInput("");

    if (/^(batal|cancel|stop)$/i.test(question)) {
      leaveAdvice();
      say(
        "assistant",
        "Oke, kita batalkan dulu. Ada yang lain yang mau dicek?"
      );
      return;
    }

    if (!active) return;

    if (active.kind === "item") {
      void runTask(async (signal) => {
        const available = inventoryReady
          ? itemsRef.current
          : await getItems(signal);

        const normalized = question.toLocaleLowerCase(
          "id-ID"
        );

        const exact = available.filter(
          (item) =>
            item.name.toLocaleLowerCase("id-ID") ===
            normalized
        );

        const partial = available.filter((item) =>
          item.name
            .toLocaleLowerCase("id-ID")
            .includes(normalized)
        );

        const matches = exact.length
          ? exact
          : partial;

        if (matches.length === 1) {
          const item = matches[0];

          updateStep({
            kind: "lead-time",
            mode: active.mode,
            item,
          });

          say(
            "assistant",
            `${item.name}, siap. Berapa hari waktu tunggu suppliernya?`
          );
        } else if (matches.length > 1) {
          say(
            "assistant",
            "Aku menemukan beberapa bahan yang mirip. Pilih salah satu dari daftar di bawah, ya."
          );
          setSearch(question);
        } else {
          say(
            "assistant",
            "Aku belum menemukan bahan itu. Coba pilih dari daftar atau ketik nama yang sesuai inventory."
          );
          setSearch("");
        }
      });

      return;
    }

    const match = question.match(
      /^(\d{1,3})(?:\s*hari)?$/i
    );

    const days = match
      ? Number(match[1])
      : NaN;

    if (
      !Number.isSafeInteger(days) ||
      days < 1 ||
      days > 365
    ) {
      say(
        "assistant",
        "Waktu tunggunya bisa antara 1 sampai 365 hari. Contohnya 3 hari."
      );
      return;
    }

    void generate(active.mode, active.item, days);
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    submitText(input);
  }

  const filteredItems = items.filter((item) =>
    item.name
      .toLocaleLowerCase("id-ID")
      .includes(search.toLocaleLowerCase("id-ID"))
  );

  return (
    <section
      role="dialog"
      aria-label="Bready Bakery Copilot"
      className="fixed inset-x-2 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[70] flex h-[min(570px,calc(100dvh-8rem))] flex-col overflow-hidden rounded-[26px] border border-[#8fa58a]/30 bg-[#faf7f0]/95 shadow-[0_24px_80px_rgba(52,59,50,0.18)] backdrop-blur-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(620px,calc(100dvh-3rem))] sm:w-[400px]"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-[#8fa58a]/15 px-4 py-3">
        <div className="size-12 shrink-0">
          <BreadyMascot talking={loading} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-[#343b32]">
            Bready
          </h2>
          <p className="text-xs text-[#7a8775]">
            Your Bakery Copilot
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup chatbot"
          className="flex size-9 items-center justify-center rounded-xl text-[#536d50] hover:bg-[#8fa58a]/15"
        >
          <X className="size-5" />
        </button>
      </header>

      <div
        aria-label="Percakapan"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5"
      >
        {messages.map((message) => (
          <BreadyMessage
            key={message.id}
            message={message}
          />
        ))}

        {step?.kind === "item" && inventoryReady && (
          <div className="space-y-3 rounded-2xl border border-[#8fa58a]/20 bg-white/75 p-3">
            <p className="text-xs font-medium text-[#536d50]">
              Pilih bahan
            </p>

            <div className="flex items-center gap-2 rounded-xl border border-[#8fa58a]/20 bg-[#faf7f0] px-3">
              <Search className="size-4 text-[#8fa58a]" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Cari bahan..."
                aria-label="Cari bahan"
                className="min-h-10 min-w-0 flex-1 bg-transparent text-xs text-[#343b32] outline-none"
              />
            </div>

            <div className="max-h-40 space-y-1 overflow-y-auto">
              {filteredItems.length ? (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={loading}
                    onClick={() => chooseItem(item)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-[#343b32] transition hover:bg-[#8fa58a]/15 disabled:opacity-50"
                  >
                    <span className="truncate">
                      {item.name}
                    </span>

                    <span className="ml-2 shrink-0 text-[#7a8775]">
                      {fmt(item.current_stock)} {item.unit}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-2 py-3 text-xs text-[#7a8775]">
                  Tidak ada bahan yang cocok.
                </p>
              )}
            </div>
          </div>
        )}

        {step?.kind === "lead-time" && (
          <div className="space-y-3 rounded-2xl border border-[#8fa58a]/20 bg-white/75 p-3">
            <p className="text-xs font-medium text-[#536d50]">
              Pilih waktu tunggu supplier
            </p>

            <div className="grid grid-cols-4 gap-2">
              {LEAD_TIME_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  disabled={loading}
                  onClick={() => chooseDays(days)}
                  className="min-h-10 rounded-xl border border-[#8fa58a]/30 bg-[#faf7f0] px-1 text-xs font-medium text-[#536d50] transition hover:border-[#536d50] hover:bg-[#8fa58a]/15 disabled:opacity-50"
                >
                  {days} hari
                </button>
              ))}
            </div>

            <p className="text-[11px] text-[#7a8775]">
              Bisa juga ketik jumlah hari sendiri.
            </p>
          </div>
        )}

        {loading && (
          <div
            role="status"
            className="w-fit rounded-2xl border border-[#8fa58a]/15 bg-white/80 px-4 py-3 text-sm text-[#536d50]"
          >
            {loadingText}
          </div>
        )}

        {showAdvice && (
          <div aria-label="Pilihan saran" className="space-y-2">
            {ADVICE_OPTIONS.map(option => (
              <button key={option.context} type="button" disabled={loading}
                onClick={() => void askBready(option.question, option.context)}
                className="block w-full rounded-2xl border border-[#8fa58a]/25 bg-white/80 px-4 py-3 text-left transition-colors hover:bg-[#edf1e8] focus-visible:outline-2 focus-visible:outline-[#536d50] disabled:opacity-50">
                <span className="block text-sm font-semibold text-[#536d50]">{option.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-[#7a8775]">{option.description}</span>
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-[#8fa58a]/10 px-3 pt-3">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            disabled={loading}
            onClick={checkStock}
            className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl border border-[#8fa58a]/25 bg-white/70 px-1 text-[11px] font-medium text-[#536d50] transition hover:bg-[#8fa58a]/15 disabled:opacity-50"
          >
            <PackageSearch className="size-3.5 shrink-0" />
            Cek Stok
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => startMode("predict")}
            className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl border border-[#8fa58a]/25 bg-white/70 px-1 text-[11px] font-medium text-[#536d50] transition hover:bg-[#8fa58a]/15 disabled:opacity-50"
          >
            <ChartNoAxesCombined className="size-3.5 shrink-0" />
            Cek Kebutuhan
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={startAdvice}
            className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl border border-[#8fa58a]/25 bg-white/70 px-1 text-[11px] font-medium text-[#536d50] transition hover:bg-[#8fa58a]/15 disabled:opacity-50"
          >
            <Lightbulb className="size-3.5 shrink-0" />
            Minta Saran
          </button>
        </div>
      </div>

      {chatContext !== "general" && (
        <div className="mx-4 mt-2 flex items-center justify-between gap-2 text-xs text-[#536d50]">
          <span>Saran: {ADVICE_OPTIONS.find(option => option.context === chatContext)?.label ?? "Bakery"}</span>
          <button type="button" disabled={loading} onClick={leaveAdvice}
            className="min-h-9 rounded-lg px-2 underline focus-visible:outline-2 disabled:opacity-50">
            Kembali ke chat bebas
          </button>
        </div>
      )}
      {step && (
        <button type="button" disabled={loading}
          onClick={() => { updateStep(null); setSearch(""); inputRef.current?.focus(); }}
          className="mx-4 mt-2 min-h-9 rounded-xl text-xs font-medium text-[#536d50] underline disabled:opacity-50">
          Kembali ke chat bebas
        </button>
      )}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 px-3 pb-4 pt-3"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-[#8fa58a]/25 bg-white/80 p-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            disabled={loading}
            maxLength={1000}
            placeholder={
              step?.kind === "item"
                ? "Ketik nama bahan..."
                : step?.kind === "lead-time"
                  ? "Contoh: 3 hari"
                  : chatContext !== "general" ? "Ceritakan kebutuhan bakerymu..." : "Tanya Bready..."
            }
            aria-label="Pesan untuk Bready"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-[#343b32] outline-none placeholder:text-[#7a8775]"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Kirim pesan"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#536d50] text-white disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </section>
  );
}
