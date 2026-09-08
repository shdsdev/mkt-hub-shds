export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-heading font-semibold">Marketing Hub</h1>
      <p className="max-w-md text-center font-sans text-muted-foreground">
        Phase 0 scaffold — locked dark palette and fonts render correctly if this
        page looks right.
      </p>
      <div className="flex gap-4">
        <div className="h-16 w-16 rounded-lg bg-background border border-border" />
        <div className="h-16 w-16 rounded-lg bg-primary" />
        <div className="h-16 w-16 rounded-lg bg-accent" />
      </div>
    </main>
  );
}
