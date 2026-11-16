import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChefHat, Clock3, Cookie, KeyRound, LockKeyhole, Mail,
  ShieldAlert, ShieldOff, UserRoundPlus, Wheat,
} from "lucide-react";
import { ClayArt } from "./clay-art";

const illustrations = {
  login: { Icon: ChefHat, Accent: Wheat, clay: "#CBDDC3", face: "#EEF5E9", ink: "#435D40", shape: "42% 42% 30% 30%" },
  register: { Icon: UserRoundPlus, Accent: Cookie, clay: "#F4D0A8", face: "#FFF1DB", ink: "#774C2D", shape: "32% 44% 32% 44%" },
  forgot: { Icon: Mail, Accent: Wheat, clay: "#DFD0EB", face: "#F6EDF9", ink: "#624B76", shape: "24% 24% 30% 30%" },
  reset: { Icon: KeyRound, Accent: LockKeyhole, clay: "#F0D695", face: "#FCEDC6", ink: "#755421", shape: "50%" },
  pending: { Icon: Clock3, Accent: Cookie, clay: "#F4C4AD", face: "#FCE7DA", ink: "#814936", shape: "50% 50% 38% 38%" },
  suspended: { Icon: ShieldOff, Accent: LockKeyhole, clay: "#E8BFC3", face: "#FAE8E9", ink: "#793F48", shape: "30% 30% 48% 48%" },
  unauthorized: { Icon: ShieldAlert, Accent: KeyRound, clay: "#BFD7DA", face: "#E5F2F3", ink: "#365B61", shape: "35% 35% 48% 48%" },
} as const;

type Illustration = keyof typeof illustrations;

function AuthIllustration({ variant }: { variant: Illustration }) {
  const { Icon, Accent, clay, face, ink, shape } = illustrations[variant];

  return (
    <div
      className="relative isolate grid aspect-square w-full max-w-[380px] place-items-center"
      style={{ color: ink }}
    >
      <div className="absolute inset-[8%] -z-10 rounded-full blur-3xl opacity-70" style={{ background: clay }} />
      <div className="absolute bottom-[14%] h-[9%] w-[62%] rounded-full bg-[#343B32]/15 blur-xl" />
      <div
        className="relative grid size-[56%] -rotate-6 place-items-center shadow-[inset_0_5px_10px_#fff9,inset_0_-14px_20px_#0002,8px_18px_25px_#343B3229]"
        style={{ borderRadius: shape, background: `linear-gradient(145deg, ${face}, ${clay})` }}
      >
        <Icon className="size-[49%] drop-shadow-[0_3px_1px_#fff9]" strokeWidth={1.7} />
      </div>
      <div
        className="absolute bottom-[17%] right-[9%] grid size-[24%] rotate-12 place-items-center rounded-[32%] shadow-[inset_0_4px_8px_#fff9,inset_0_-7px_12px_#0002,3px_9px_15px_#343B3222]"
        style={{ background: face }}
      >
        <Accent className="size-[50%]" strokeWidth={1.7} />
      </div>
    </div>
  );
}

type AuthShellProps = {
  children: ReactNode;
  eyebrow?: string;
  illustration?: Illustration;
  title: string;
  description: string;
};

export function AuthShell({
  children,
  illustration,
  title,
  description,
}: AuthShellProps) {
  return (
    <main className="po-auth relative isolate min-h-dvh overflow-x-hidden bg-[#F8F6EF] text-[#343B32]">
      {/* Soft background accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-24 size-64 rounded-full bg-[#EBD8B9]/45 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-12 size-72 rounded-full bg-[#D5E2CF]/65 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-5 sm:px-8 sm:py-7 lg:px-12">
        <header className="flex items-center justify-start">
          <Link
            href="/login"
            aria-label="PantryOven — halaman login"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#536D50]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-[#8FA58A]/25 bg-[#E7EEE2]">
              <ChefHat
                aria-hidden="true"
                className="size-6 text-[#536D50]"
              />
            </span>

            <span className="text-lg font-extrabold tracking-tight">
              PantryOven
              <span className="text-[#536D50]">.</span>
            </span>
          </Link>
        </header>

        {/* Responsive content */}
        <div className="grid flex-1 items-center gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          {/* Floating illustration */}
          <div aria-hidden="true" className="hidden min-w-0 items-center justify-center lg:order-2 lg:flex">
            {illustration ? <AuthIllustration variant={illustration} /> : <ClayArt />}
          </div>

          {/* Authentication content */}
          <section className="po-enter mx-auto w-full min-w-0 max-w-[440px] lg:order-1">
            <div className="mb-5 space-y-2 sm:mb-6">
              <h1 className="text-[clamp(2rem,5vw,2.8rem)] font-semibold leading-[1.15] tracking-[-0.045em]">
                {title}
              </h1>

              <p className="max-w-sm text-sm leading-6 text-[#5F705B]">
                {description}
              </p>
            </div>

            {/* Form container */}
            <div className="rounded-[26px] border border-white/80 bg-white/70 p-4 shadow-[0_10px_36px_rgba(52,59,50,0.06)] backdrop-blur-xl sm:p-8">
              {children}
            </div>
          </section>
        </div>

        {/* Minimal footer */}
        <footer className="pt-2 text-center text-xs text-[#5F705B]">
          © {new Date().getFullYear()} PantryOven
        </footer>
      </div>
    </main>
  );
}
