import { openDB, type IDBPDatabase } from "idb"
import { type Konsultasjon, TTL_MS } from "@/types/konsultasjon"
import { cuid } from "@/lib/cuid"

interface LegeassistDB {
  konsultasjoner: {
    key: string
    value: Konsultasjon
    indexes: { "by-created": number; "by-expires": number }
  }
}

let db: IDBPDatabase<LegeassistDB> | null = null

async function getDB(): Promise<IDBPDatabase<LegeassistDB>> {
  if (db) return db
  db = await openDB<LegeassistDB>("legeassist", 1, {
    upgrade(database) {
      const store = database.createObjectStore("konsultasjoner", {
        keyPath: "id",
      })
      store.createIndex("by-created", "createdAt")
      store.createIndex("by-expires", "expiresAt")
    },
  })
  return db
}

export async function hentAlleKonsultasjoner(): Promise<Konsultasjon[]> {
  const database = await getDB()
  const alle = await database.getAll("konsultasjoner")
  const naa = Date.now()
  return alle
    .filter((k) => k.expiresAt > naa)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function hentKonsultasjon(
  id: string
): Promise<Konsultasjon | undefined> {
  const database = await getDB()
  return database.get("konsultasjoner", id)
}

export async function lagreKonsultasjon(
  k: Konsultasjon
): Promise<void> {
  const database = await getDB()
  await database.put("konsultasjoner", k)
}

export async function slettKonsultasjon(id: string): Promise<void> {
  const database = await getDB()
  await database.delete("konsultasjoner", id)
}

export async function slettAlleKonsultasjoner(): Promise<void> {
  const database = await getDB()
  await database.clear("konsultasjoner")
}

export async function slettUtlopteKonsultasjoner(): Promise<void> {
  const database = await getDB()
  const alle = await database.getAll("konsultasjoner")
  const naa = Date.now()
  const tx = database.transaction("konsultasjoner", "readwrite")
  await Promise.all(
    alle
      .filter((k) => k.expiresAt <= naa)
      .map((k) => tx.store.delete(k.id))
  )
  await tx.done
}

export function nyKonsultasjon(
  type: Konsultasjon["type"]
): Konsultasjon {
  const naa = Date.now()
  return {
    id: cuid(),
    type,
    pasientId: "",
    transkript: "",
    notat: "",
    kontekst: "",
    tilleggsinfo: "",
    malId: null,
    malInnhold: null,
    status: "ny",
    createdAt: naa,
    expiresAt: naa + TTL_MS,
  }
}
