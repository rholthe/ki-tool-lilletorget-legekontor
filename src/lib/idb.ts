import { openDB, type IDBPDatabase } from "idb"
import { type Konsultasjon, TTL_MS } from "@/types/konsultasjon"
import { cuid } from "@/lib/cuid"
import { hentDataKontekst, krypter, dekrypter, type DataKontekst } from "@/lib/datakrypto"

/**
 * Konsultasjoner lagres kryptert per bruker. Kun id, eier og tidsstempler ligger
 * i klartekst (trengs for listing og 24-timers sletting); alt pasientinnhold
 * ligger i `chiffer`. Uten innlogget brukers nøkkel er postene låst.
 */
interface KryptertKonsultasjon {
  id: string
  userId: string
  createdAt: number
  expiresAt: number
  iv: Uint8Array<ArrayBuffer>
  chiffer: ArrayBuffer
}

/** Poster fra før krypteringen ble innført, uten eier. Krypteres ved første lesing. */
type GammelKonsultasjon = Konsultasjon

type LagretPost = KryptertKonsultasjon | GammelKonsultasjon

interface LegeassistDB {
  konsultasjoner: {
    key: string
    value: LagretPost
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

function erKryptert(p: LagretPost): p is KryptertKonsultasjon {
  return "chiffer" in p
}

async function tilLagret(k: Konsultasjon, ktx: DataKontekst): Promise<KryptertKonsultasjon> {
  const { iv, chiffer } = await krypter(k, ktx.nokkel)
  return { id: k.id, userId: ktx.userId, createdAt: k.createdAt, expiresAt: k.expiresAt, iv, chiffer }
}

/** Dekrypterer en post som tilhører brukeren. Andres poster og feil nøkkel gir undefined. */
async function lesPost(
  database: IDBPDatabase<LegeassistDB>,
  p: LagretPost,
  ktx: DataKontekst
): Promise<Konsultasjon | undefined> {
  if (!erKryptert(p)) {
    // Overgang: ukrypterte poster fra før denne versjonen tilfaller den som
    // først logger inn, og krypteres med en gang.
    await database.put("konsultasjoner", await tilLagret(p, ktx))
    return p
  }
  if (p.userId !== ktx.userId) return undefined
  try {
    return await dekrypter<Konsultasjon>(p, ktx.nokkel)
  } catch {
    return undefined
  }
}

export async function hentAlleKonsultasjoner(): Promise<Konsultasjon[]> {
  const [database, ktx] = await Promise.all([getDB(), hentDataKontekst()])
  const alle = await database.getAll("konsultasjoner")
  const naa = Date.now()
  const leste = await Promise.all(
    alle.filter((p) => p.expiresAt > naa).map((p) => lesPost(database, p, ktx))
  )
  return leste
    .filter((k): k is Konsultasjon => k !== undefined)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function hentKonsultasjon(
  id: string
): Promise<Konsultasjon | undefined> {
  const [database, ktx] = await Promise.all([getDB(), hentDataKontekst()])
  const p = await database.get("konsultasjoner", id)
  return p ? lesPost(database, p, ktx) : undefined
}

export async function lagreKonsultasjon(
  k: Konsultasjon
): Promise<void> {
  const [database, ktx] = await Promise.all([getDB(), hentDataKontekst()])
  await database.put("konsultasjoner", await tilLagret(k, ktx))
}

export async function slettKonsultasjon(id: string): Promise<void> {
  const database = await getDB()
  await database.delete("konsultasjoner", id)
}

/**
 * Sletter alle konsultasjonene til innlogget bruker på denne maskinen (også
 * ukrypterte poster fra før kryptering). Andre brukeres poster blir liggende.
 * Brukes av «Slett alle» og av «Logg ut».
 */
export async function slettAlleKonsultasjoner(): Promise<void> {
  const [database, ktx] = await Promise.all([getDB(), hentDataKontekst()])
  const alle = await database.getAll("konsultasjoner")
  const tx = database.transaction("konsultasjoner", "readwrite")
  await Promise.all(
    alle
      .filter((p) => !erKryptert(p) || p.userId === ktx.userId)
      .map((p) => tx.store.delete(p.id))
  )
  await tx.done
}

/** Sletter utløpte poster for alle brukere (24 timer etter opprettelse). */
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
