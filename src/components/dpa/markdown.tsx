import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

// Tailwind-stiling for markdown (ingen typography-plugin nødvendig).
const komponenter: Components = {
  h1: (p) => <h1 className="text-xl font-semibold text-slate-900 mt-6 mb-2" {...p} />,
  h2: (p) => (
    <h2
      className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-1 mt-8 mb-3"
      {...p}
    />
  ),
  h3: (p) => <h3 className="text-base font-semibold text-slate-800 mt-5 mb-2" {...p} />,
  p: (p) => <p className="text-sm leading-relaxed text-slate-600 my-3" {...p} />,
  ul: (p) => <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 my-3" {...p} />,
  ol: (p) => <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 my-3" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  a: (p) => <a className="text-blue-600 hover:underline" {...p} />,
  strong: (p) => <strong className="font-semibold text-slate-700" {...p} />,
  code: (p) => <code className="bg-slate-100 px-1 rounded text-[0.85em]" {...p} />,
  hr: () => <hr className="my-6 border-slate-200" />,
  blockquote: (p) => (
    <blockquote className="border-l-2 border-slate-300 pl-3 text-slate-500 italic my-3" {...p} />
  ),
  table: (p) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden" {...p} />
    </div>
  ),
  thead: (p) => <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500" {...p} />,
  th: (p) => <th className="px-3 py-2 font-medium" {...p} />,
  tr: (p) => <tr className="border-t border-slate-200" {...p} />,
  td: (p) => <td className="px-3 py-2 text-slate-600 align-top" {...p} />,
}

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={komponenter}>
      {children}
    </ReactMarkdown>
  )
}
