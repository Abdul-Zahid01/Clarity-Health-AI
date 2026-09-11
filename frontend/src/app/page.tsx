import { ReportUploader } from "@/components/report-uploader";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center bg-[var(--ink)] text-sm font-bold text-white">C</span>
            <span className="font-display text-xl font-semibold text-[var(--ink)]">Clarity Health</span>
          </div>
          <span className="border border-[var(--amber)] bg-[var(--amber-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--amber-ink)]">Synthetic data only</span>
        </div>
      </header>
      <main className="workspace-grid mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:py-20">
        <section className="workspace-intro pt-2">
          <p className="mb-4 text-xs font-bold uppercase text-[var(--teal)]">Report workspace</p>
          <h1 className="font-display max-w-lg text-4xl leading-[1.08] font-semibold text-[var(--ink)] sm:text-5xl">Make the details in your health report visible.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[var(--muted)]">Upload a text-based PDF to inspect its page-level extraction before analysis begins.</p>
          <div className="mt-10 grid max-w-md grid-cols-3 border-y border-[var(--line)] py-5">
            <div><strong className="block text-sm text-[var(--ink)]">01</strong><span className="mt-1 block text-xs text-[var(--muted)]">Upload</span></div>
            <div className="border-x border-[var(--line)] px-5"><strong className="block text-sm text-[var(--ink)]">02</strong><span className="mt-1 block text-xs text-[var(--muted)]">Extract</span></div>
            <div className="pl-5"><strong className="block text-sm text-[var(--ink)]">03</strong><span className="mt-1 block text-xs text-[var(--muted)]">Review</span></div>
          </div>
        </section>
        <ReportUploader />
      </main>
    </div>
  );
}
