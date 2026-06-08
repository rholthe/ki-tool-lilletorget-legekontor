import { prisma } from "@/lib/db"

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
  return admins.includes(email)
}

export async function hentSystemSetting(
  key: string,
  defaultValue: string
): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } })
  return setting?.value ?? defaultValue
}

export async function settSystemSetting(
  key: string,
  value: string
): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

export function tilgjengeligeModeller(): string[] {
  return (process.env.BEDROCK_MODELS ?? "eu.anthropic.claude-sonnet-4-6")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
}

export function tilgjengeligeRegioner(): string[] {
  return (process.env.BEDROCK_REGIONS ?? "eu-central-1")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
}

export function standardModell(): string {
  return process.env.ANTHROPIC_MODEL ?? tilgjengeligeModeller()[0] ?? "eu.anthropic.claude-sonnet-4-6"
}

export function standardRegion(): string {
  return process.env.AWS_REGION ?? tilgjengeligeRegioner()[0] ?? "eu-central-1"
}
