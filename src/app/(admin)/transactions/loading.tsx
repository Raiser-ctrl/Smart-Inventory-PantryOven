function Placeholder({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-[#84927b]/15 motion-safe:animate-pulse ${className}`} />;
}

export default function TransactionsLoading() {
  return (
    <div role="status" aria-label="Memuat transactions" className="min-w-0 space-y-4 pb-28 lg:space-y-5 lg:pb-6">
      <span className="sr-only">Sedang memuat riwayat transaksi.</span>
      <div aria-hidden="true" className="space-y-4 lg:space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Placeholder className="h-8 w-44 sm:h-9" />
            <Placeholder className="h-5 w-60 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Placeholder className="h-10 w-32 rounded-xl bg-[#c99165]/15" />
            <Placeholder className="h-10 w-28 rounded-xl bg-[#8fa58a]/25" />
          </div>
        </div>
        <div className="min-w-0 overflow-hidden rounded-[24px] border border-white/60 bg-white/55 shadow-[0_8px_28px_rgba(52,59,50,0.035)]">
          <div className="space-y-3 p-3 sm:p-5">
            <div className="flex w-fit max-w-full gap-1 rounded-2xl border border-[#8fa58a]/10 bg-[#f8f6ef]/70 p-1">
              {[0, 1, 2].map(index => (
                <Placeholder key={index} className={`h-10 w-20 rounded-xl sm:w-24 ${index === 0 ? "bg-[#8fa58a]/20" : "opacity-50"}`} />
              ))}
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Placeholder className="h-10 min-w-0 flex-1 rounded-xl" />
              <Placeholder className="h-10 w-10 shrink-0 rounded-xl bg-[#c99165]/15 sm:w-24" />
              <Placeholder className="h-10 w-10 shrink-0 rounded-xl sm:w-24" />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map(index => (
                <div key={index} className="min-w-0 space-y-2">
                  <Placeholder className="h-3 w-16" />
                  <Placeholder className="h-10 w-full rounded-xl bg-[#c9b38c]/15" />
                </div>
              ))}
            </div>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1.5fr_1fr] gap-4 border-y border-[#8fa58a]/10 bg-[#f8f6ef]/70 px-5 py-4">
                {[0, 1, 2, 3, 4].map(index => <Placeholder key={index} className="h-4 w-16 max-w-full" />)}
              </div>
              <div className="divide-y divide-[#8fa58a]/10">
                {[0, 1, 2, 3, 4].map(index => (
                  <div key={index} className="grid grid-cols-[1.5fr_1fr_0.8fr_1.5fr_1fr] items-start gap-4 px-5 py-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <Placeholder className="size-9 shrink-0 rounded-xl" />
                      <Placeholder className="h-4 w-24 max-w-full" />
                    </div>
                    <Placeholder className={`h-6 w-20 rounded-full ${index % 2 ? "bg-[#c99165]/15" : "bg-[#8fa58a]/20"}`} />
                    <Placeholder className="h-5 w-14" />
                    <div className="space-y-2"><Placeholder className="h-3 w-full" /><Placeholder className="h-3 w-2/3" /></div>
                    <div className="space-y-2"><Placeholder className="h-3 w-20" /><Placeholder className="h-3 w-12" /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="divide-y divide-[#8fa58a]/10 border-t border-[#8fa58a]/10 md:hidden">
            {[0, 1, 2, 3].map(index => (
              <div key={index} className="space-y-4 p-4">
                <div className="flex items-center gap-3">
                  <Placeholder className="size-9 shrink-0 rounded-xl" />
                  <Placeholder className="h-4 min-w-0 flex-1" />
                  <Placeholder className={`h-6 w-20 shrink-0 rounded-full ${index % 2 ? "bg-[#c99165]/15" : "bg-[#8fa58a]/20"}`} />
                </div>
                <div className="flex justify-between gap-3"><Placeholder className="h-5 w-16" /><Placeholder className="h-4 w-28" /></div>
                <Placeholder className="h-12 w-full rounded-xl bg-[#c9b38c]/10" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#8fa58a]/10 p-4 sm:px-5">
            <Placeholder className="h-4 w-28" />
            <div className="flex gap-2">
              <Placeholder className="size-9 rounded-xl" />
              <Placeholder className="size-9 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
