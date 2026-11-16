
export default function BakeryMorningArt() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-40 w-full items-center justify-center overflow-hidden sm:h-48"
    >
      <div className="absolute size-44 rounded-full bg-white/30 blur-2xl" />

      {/* Plate */}
      <div className="absolute bottom-3 h-12 w-52 rounded-[50%] border-[7px] border-white/65 bg-[#e9d9bf] shadow-[0_12px_20px_rgba(93,65,39,0.13)]" />

      {/* Croissant */}
      <div className="relative -translate-y-2 rotate-[-12deg]">
        <div className="absolute left-[-38px] top-7 h-14 w-20 rotate-[-28deg] rounded-[60%_35%_60%_35%] bg-gradient-to-br from-[#e7b46f] via-[#c88c4e] to-[#a56b38] shadow-md" />

        <div className="absolute right-[-38px] top-7 h-14 w-20 rotate-[28deg] rounded-[35%_60%_35%_60%] bg-gradient-to-bl from-[#e7b46f] via-[#c88c4e] to-[#a56b38] shadow-md" />

        <div className="relative h-24 w-36 rounded-[45%_45%_42%_42%] bg-gradient-to-b from-[#f7d59c] via-[#d99d5c] to-[#b7763f] shadow-[inset_0_-9px_12px_rgba(125,69,29,0.18),0_10px_20px_rgba(93,65,39,0.16)]">
          <div className="absolute left-[29%] top-3 h-[75%] w-3 rotate-[12deg] rounded-full bg-[#b97a41]/35" />
          <div className="absolute right-[29%] top-3 h-[75%] w-3 rotate-[-12deg] rounded-full bg-[#b97a41]/35" />
          <div className="absolute left-8 right-8 top-3 h-3 rounded-full bg-white/30 blur-sm" />
        </div>
      </div>

      {/* Decorative sparkle */}
      <span className="absolute right-8 top-5 text-xl text-[#b98550]">
        ✦
      </span>
      <span className="absolute left-8 top-10 text-sm text-[#b98550]">
        ✧
      </span>
    </div>
  );
}
