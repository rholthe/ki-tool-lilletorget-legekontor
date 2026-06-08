"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

interface Props {
  model: string
  region: string
  availableModels: string[]
  availableRegions: string[]
}

type TestResultat =
  | { ok: true; svar: string; model: string; region: string }
  | { ok: false; feil: string; model: string; region: string }
  | null

export function BedrockInnstillinger({
  model: initialModel,
  region: initialRegion,
  availableModels,
  availableRegions,
}: Props) {
  const [model, setModel] = useState(initialModel)
  const [region, setRegion] = useState(initialRegion)
  const [lagrer, setLagrer] = useState(false)
  const [tester, setTester] = useState(false)
  const [lagret, setLagret] = useState(false)
  const [testResultat, setTestResultat] = useState<TestResultat>(null)

  async function lagreInnstillinger() {
    setLagrer(true)
    setLagret(false)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, region }),
      })
      if (res.ok) setLagret(true)
    } finally {
      setLagrer(false)
    }
  }

  async function testTilkobling() {
    setTester(true)
    setTestResultat(null)
    try {
      const res = await fetch("/api/admin/test-bedrock", { method: "POST" })
      const data = await res.json()
      setTestResultat(data)
    } finally {
      setTester(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Modellvalg */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Claude-modell
        </label>
        <div className="space-y-2">
          {availableModels.map((m) => (
            <label
              key={m}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                model === m
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="model"
                value={m}
                checked={model === m}
                onChange={() => setModel(m)}
                className="accent-blue-600"
              />
              <code className="text-sm text-slate-700">{m}</code>
            </label>
          ))}
        </div>
      </div>

      {/* Regionvalg */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          AWS-region
        </label>
        <div className="space-y-2">
          {availableRegions.map((r) => (
            <label
              key={r}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                region === r
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="region"
                value={r}
                checked={region === r}
                onChange={() => setRegion(r)}
                className="accent-blue-600"
              />
              <span className="text-sm text-slate-700">
                <code>{r}</code>
                {r === "eu-central-1" && (
                  <span className="ml-2 text-slate-400">(Frankfurt)</span>
                )}
                {r === "eu-west-1" && (
                  <span className="ml-2 text-slate-400">(Irland)</span>
                )}
                {r === "eu-north-1" && (
                  <span className="ml-2 text-slate-400">(Stockholm)</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Handlinger */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={lagreInnstillinger}
          disabled={lagrer}
          size="sm"
        >
          {lagrer ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Lagre innstillinger
        </Button>

        <Button
          onClick={testTilkobling}
          disabled={tester}
          variant="outline"
          size="sm"
        >
          {tester ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          Test tilkobling
        </Button>

        {lagret && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            Lagret
          </span>
        )}
      </div>

      {/* Testresultat */}
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
                Modell:{" "}
                <code className="bg-green-100 px-1 rounded">
                  {testResultat.model}
                </code>{" "}
                · Region:{" "}
                <code className="bg-green-100 px-1 rounded">
                  {testResultat.region}
                </code>
              </p>
              <p className="text-green-600">
                Svar: <em>{testResultat.svar}</em>
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-red-700">
                <XCircle className="w-4 h-4" />
                Tilkobling feilet
              </div>
              <p className="text-red-600">
                Modell:{" "}
                <code className="bg-red-100 px-1 rounded">
                  {testResultat.model}
                </code>{" "}
                · Region:{" "}
                <code className="bg-red-100 px-1 rounded">
                  {testResultat.region}
                </code>
              </p>
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
