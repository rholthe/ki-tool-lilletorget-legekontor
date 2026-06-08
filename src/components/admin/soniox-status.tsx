"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

type TestResultat =
  | { ok: true; endepunkt: string }
  | { ok: false; feil: string }
  | null

export function SonioxStatus({ harNokkel }: { harNokkel: boolean }) {
  const [tester, setTester] = useState(false)
  const [testResultat, setTestResultat] = useState<TestResultat>(null)

  async function testTilkobling() {
    setTester(true)
    setTestResultat(null)
    try {
      const res = await fetch("/api/admin/test-soniox", { method: "POST" })
      const data = await res.json()
      setTestResultat(data)
    } finally {
      setTester(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">SONIOX_API_KEY</span>
        {harNokkel ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            Konfigurert
          </span>
        ) : (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            Mangler
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={testTilkobling}
          disabled={tester || !harNokkel}
          variant="outline"
          size="sm"
        >
          {tester && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Test tilkobling
        </Button>
      </div>

      {testResultat && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            testResultat.ok
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          {testResultat.ok ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                Tilkobling OK
              </div>
              <p className="text-green-600">
                Temp-token generert fra{" "}
                <code className="bg-green-100 px-1 rounded">
                  {testResultat.endepunkt}
                </code>
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-red-700">
                <XCircle className="w-4 h-4" />
                Tilkobling feilet
              </div>
              <p className="text-red-600 font-mono text-xs break-all">
                {testResultat.feil}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
