// Walking Skeleton — Landing Page
// Proves brand token resolves: primary (#E30613) visible on load
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Brand wordmark */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <span className="text-xl font-bold">F</span>
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-foreground">
            FITNESS UNIC
          </h1>
        </div>

        {/* Product tagline */}
        <p className="max-w-md text-lg text-muted-foreground">
          CMO autônomo para academias. Campanhas, leads e conteúdo — 24/7.
        </p>

        {/* Primary CTA — brand red (#E30613) */}
        <a
          href="/signup"
          className="inline-flex h-11 min-w-[160px] items-center justify-center rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Criar conta
        </a>

        {/* Auth link */}
        <p className="text-sm text-muted-foreground">
          Já tem conta?{" "}
          <a href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Entrar na conta
          </a>
        </p>
      </div>
    </main>
  );
}
