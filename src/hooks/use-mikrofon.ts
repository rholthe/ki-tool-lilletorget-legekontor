"use client"

import { useState, useEffect, useCallback } from "react"

const LAGRING_NOKKEL = "legeassist_mikrofon_id"

export interface MikofonInfo {
  deviceId: string
  label: string
}

export function useMikrofon() {
  const [mikrofoner, setMikrofoner] = useState<MikofonInfo[]>([])
  const [valgtId, setValgtIdState] = useState<string | null>(null)
  const [tillatelse, setTillatelse] = useState<"ukjent" | "gitt" | "nektet">(
    "ukjent"
  )

  const lastMikrofoner = useCallback(async () => {
    try {
      const alle = await navigator.mediaDevices.enumerateDevices()
      const lydinngang = alle
        .filter((e) => e.kind === "audioinput")
        .map((e, i) => ({
          deviceId: e.deviceId,
          label: e.label || `Mikrofon ${i + 1}`,
        }))
      setMikrofoner(lydinngang)

      // Fjern lagret valg hvis enheten ikke lenger finnes
      const lagret = localStorage.getItem(LAGRING_NOKKEL)
      if (lagret && !lydinngang.find((m) => m.deviceId === lagret)) {
        localStorage.removeItem(LAGRING_NOKKEL)
        setValgtIdState(null)
      }
    } catch {
      // Ingen tillatelse ennå — listen forblir tom
    }
  }, [])

  // Last inn lagret valg og oppdater liste ved oppstart
  useEffect(() => {
    const lagret = localStorage.getItem(LAGRING_NOKKEL)
    if (lagret) setValgtIdState(lagret)
    lastMikrofoner()

    navigator.mediaDevices.addEventListener("devicechange", lastMikrofoner)
    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", lastMikrofoner)
  }, [lastMikrofoner])

  // Be om mikrofontillatelse og oppdater listen med etiketter
  const beOmTillatelse = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setTillatelse("gitt")
      await lastMikrofoner()
    } catch {
      setTillatelse("nektet")
    }
  }, [lastMikrofoner])

  function velgMikrofon(deviceId: string) {
    setValgtIdState(deviceId)
    localStorage.setItem(LAGRING_NOKKEL, deviceId)
  }

  const valgt = mikrofoner.find((m) => m.deviceId === valgtId) ?? mikrofoner[0] ?? null

  return {
    mikrofoner,
    valgtId: valgt?.deviceId ?? null,
    valgtEtikett: valgt?.label ?? "Standardmikrofon",
    velgMikrofon,
    beOmTillatelse,
    tillatelse,
  }
}
