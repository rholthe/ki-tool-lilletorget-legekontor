import { auth, signOut } from "@/lib/auth"

export default async function HjemmePage() {
  const session = await auth()

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto">
          <span className="text-white font-bold text-lg">LA</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-800">legeassist</h1>
        <p className="text-slate-500">
          Innlogget som{" "}
          <span className="font-medium text-slate-700">
            {session?.user?.name ?? session?.user?.email}
          </span>
        </p>
        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/login" })
          }}
        >
          <button
            type="submit"
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Logg ut
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-8">
          Konsultasjonsgrensesnitt kommer her
        </p>
      </div>
    </div>
  )
}
