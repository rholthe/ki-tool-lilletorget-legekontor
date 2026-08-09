"use server"

import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { hentGjeldendeDpa } from "@/lib/dpa"

export type SignerState = { error?: string; success?: boolean }

/** Signerer databehandleravtalen for den innloggede brukeren. */
export async function signerAvtale(
  _prev: SignerState,
  formData: FormData
): Promise<SignerState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Du må være innlogget." }
  }
  if (formData.get("godta") !== "ja") {
    return { error: "Du må krysse av for å signere avtalen." }
  }

  const gjeldende = await hentGjeldendeDpa()
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      dpaSignedAt: new Date(),
      dpaVersion: gjeldende.versjon,
    },
  })

  return { success: true }
}
