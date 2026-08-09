"use client"

export default function GlobalFeil({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4 max-w-md px-6">
          <h2 className="text-lg font-semibold text-slate-800">
            Kritisk feil
          </h2>
          <p className="text-sm text-slate-500 font-mono bg-slate-100 p-3 rounded-lg text-left break-all">
            {error.message}
          </p>
          <button
            onClick={reset}
            className="text-sm text-blue-600 hover:underline"
          >
            Prøv igjen
          </button>
        </div>
      </body>
    </html>
  )
}
