
import { Wheat } from "lucide-react";

export function ClayArt() {
  return (
    <div
      aria-hidden="true"
      className="po-art relative mx-auto h-44 w-full max-w-[300px] select-none sm:h-60 sm:max-w-[340px] lg:h-[350px] lg:max-w-[420px]"
    >
      {/* Soft organic background */}
      <div className="po-blob absolute inset-x-[15%] top-[12%] h-[75%] rounded-[45%_55%_50%_45%] bg-[#e5e9dc]" />

      {/* Small wheat decoration — no repeated logo */}
      <div className="po-float-delayed absolute left-[14%] top-[19%] z-20 rotate-[-18deg]">
        <Wheat
          strokeWidth={1.5}
          className="size-7 text-[#b9926c] sm:size-9"
        />
      </div>

      {/* Main clay bread */}
      <div className="po-float absolute left-[22%] top-[31%] z-10 h-[45%] w-[56%] rotate-[-9deg] rounded-[43%_43%_25%_25%] border-[5px] border-[#dca36b] bg-gradient-to-br from-[#f9d8a1] via-[#eab87b] to-[#cf8b57] shadow-[12px_18px_22px_#82644938,inset_6px_7px_13px_#ffe7b9]">
        {/* Bread scoring */}
        <div className="absolute left-[23%] top-[17%] h-[48%] w-[5px] rotate-[22deg] rounded-full bg-[#bd7b4d]/45" />
        <div className="absolute left-[50%] top-[12%] h-[55%] w-[5px] rotate-[22deg] rounded-full bg-[#bd7b4d]/45" />
        <div className="absolute left-[74%] top-[18%] h-[45%] w-[5px] rotate-[22deg] rounded-full bg-[#bd7b4d]/45" />
      </div>

      {/* Small clay dough */}
      <div className="po-float-delayed absolute bottom-[12%] right-[15%] z-20 size-[22%] rounded-[48%_52%_47%_53%] bg-gradient-to-br from-[#f8e6d4] to-[#dcae91] shadow-[8px_12px_17px_#98785b33,inset_5px_6px_10px_#fff2e5]" />

      {/* Ground shadow */}
      <div className="absolute bottom-[10%] left-[22%] h-[8%] w-[55%] rounded-full bg-[#92755c]/15 blur-xl" />

      {/* Subtle accent */}
      <div className="absolute bottom-[20%] left-[10%] size-2.5 rounded-full bg-[#dba978]" />
    </div>
  );
}
