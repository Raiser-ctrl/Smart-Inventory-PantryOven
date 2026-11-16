// Keep this layout aligned with the dashboard page to reduce layout shifts.
const tones = [
  "bg-[#edf1e8]/70 border-[#8fa58a]/20",
  "bg-[#f5eae0]/65 border-[#c99165]/20",
  "bg-[#f3ecdf]/70 border-[#c9b38c]/20",
  "bg-[#faf1d9]/65 border-[#d4ac72]/20",
];

function Placeholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-[#84927b]/15 motion-safe:animate-pulse ${className}`}
    />
  );
}

const panel =
  "min-w-0 rounded-[22px] border border-white/60 bg-white/55 p-4 shadow-[0_8px_28px_rgba(52,59,50,0.035)] sm:p-5";

export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Memuat dashboard"
      className="mx-auto min-w-0 max-w-7xl space-y-5 lg:space-y-6"
    >
      <span className="sr-only">Sedang memuat ringkasan dashboard.</span>
      <div aria-hidden="true" className="space-y-5 lg:space-y-6">
        {/* Heading and analytics period */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Placeholder className="h-8 w-40 sm:h-9 sm:w-48" />
          <div className="flex shrink-0 gap-1 rounded-2xl border border-white/40 bg-white/40 p-1">
            <Placeholder className="h-10 w-20 rounded-xl" />
            <Placeholder className="h-10 w-20 rounded-xl opacity-50" />
          </div>
        </div>

        {/* Compact welcome banner */}
        <div className="po-bakery-accent overflow-hidden rounded-[24px] border border-[#c99165]/15 bg-[#f4ecdf]/65">
          <div className="grid min-w-0 items-center gap-3 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_190px] lg:grid-cols-[minmax(0,1fr)_230px]">
            <div className="min-w-0 space-y-3">
              <div className="space-y-2">
                <Placeholder className="h-6 w-72 max-w-full sm:h-7" />
                <Placeholder className="h-6 w-64 max-w-[90%] sm:h-7" />
                <Placeholder className="h-5 w-96 max-w-full" />
              </div>
              <Placeholder className="h-10 w-40 rounded-xl" />
            </div>
            <div className="hidden justify-center md:flex">
              <Placeholder className="h-32 w-36 rounded-[40px] bg-[#c99165]/15" />
            </div>
          </div>
        </div>

        {/* Statistics: two columns on mobile, four on desktop */}
        <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {tones.map((tone) => (
            <div
              key={tone}
              className={`flex min-w-0 flex-col justify-between gap-4 rounded-[22px] border p-4 shadow-[0_8px_28px_rgba(52,59,50,0.035)] sm:p-5 ${tone}`}
            >
              <div className="flex items-start justify-between gap-2">
                <Placeholder className="mt-1 h-4 w-24 max-w-[65%]" />
                <Placeholder className="size-9 shrink-0 rounded-xl" />
              </div>
              <Placeholder className="h-8 w-14 sm:h-9" />
            </div>
          ))}
        </div>

        {/* Operations overview */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Placeholder className="size-5 shrink-0 rounded-md" />
              <Placeholder className="h-6 w-44 max-w-full" />
            </div>
            <Placeholder className="my-2 h-6 w-28" />
          </div>

          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
            <div className={panel}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Placeholder className="h-5 w-36" />
                <Placeholder className="h-7 w-24 rounded-full" />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="min-w-0 space-y-3 rounded-2xl bg-[#f4f2eb]/80 p-3">
                    <Placeholder className="h-3 w-16 max-w-full" />
                    <Placeholder className="h-6 w-12 max-w-full" />
                  </div>
                ))}
              </div>
              {/* Neutral chart placeholder: no fabricated trend or values. */}
              <Placeholder className="mt-5 h-52 w-full rounded-2xl bg-[#84927b]/10 sm:h-60" />
              <div className="mt-3 flex justify-between gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <Placeholder key={index} className="h-3 w-10" />
                ))}
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-[22px] border border-[#d4ac72]/20 bg-[#faf1df]/65 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <Placeholder className="h-5 w-32" />
                  <Placeholder className="size-8 shrink-0 rounded-xl bg-[#d4ac72]/20" />
                </div>
                <Placeholder className="mt-4 h-4 w-full" />
                <Placeholder className="mt-2 h-4 w-3/4" />
              </div>
              <div className={panel}>
                <Placeholder className="mb-4 h-5 w-36" />
                <div className="divide-y divide-[#8fa58a]/10">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex items-center gap-3 py-3">
                      <Placeholder className="size-9 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Placeholder className="h-4 w-28 max-w-full" />
                        <Placeholder className="h-3 w-16 max-w-full" />
                      </div>
                      <Placeholder className="h-6 w-12 shrink-0 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
