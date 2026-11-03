import { QuickQrForm } from "./quick-qr-form";

export default function QuickQrPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Quick QR</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Genera un código QR temporal sin guardarlo en el Hub.
        </p>
      </div>
      <QuickQrForm />
    </div>
  );
}
