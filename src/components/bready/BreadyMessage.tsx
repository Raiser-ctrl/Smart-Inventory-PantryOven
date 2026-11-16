"use client";

export type BreadyChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type BreadyMessageProps = {
  message: BreadyChatMessage;
};

export default function BreadyMessage({
  message,
}: BreadyMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={[
          "max-w-[88%] whitespace-pre-wrap",
          "break-words rounded-[20px]",
          "px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md bg-[#536d50] text-white"
            : "rounded-bl-md border border-[#8fa58a]/15 bg-white/80 text-[#343b32]",
        ].join(" ")}
      >
        {message.content}
      </div>
    </div>
  );
}