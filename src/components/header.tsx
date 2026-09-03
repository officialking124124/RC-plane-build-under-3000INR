import Link from "next/link";
import { MapPin } from "lucide-react";
import { ProviderStatus } from "@/components/provider-status";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-[#05070d]/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950">
            <MapPin size={18} strokeWidth={2.4} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-100">Locus</span>
          <span className="hidden rounded-md border border-slate-700/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-400 sm:inline">
            beta
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/" className="text-slate-300 transition-colors hover:text-cyan-300">
            Analyze
          </Link>
          <Link href="/docs" className="text-slate-300 transition-colors hover:text-cyan-300">
            API Docs
          </Link>
          <ProviderStatus />
        </nav>
      </div>
    </header>
  );
}
