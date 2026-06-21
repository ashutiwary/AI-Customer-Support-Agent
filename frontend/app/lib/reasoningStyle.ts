export function reasoningStyle(line: string) {
  if (line.startsWith("Agent called")) {
    return { icon: "→", color: "border-blue-400 bg-blue-50 text-blue-900" };
  }
  if (line.startsWith("Tool '")) {
    return { icon: "✓", color: "border-slate-300 bg-slate-50 text-slate-700" };
  }
  if (line.startsWith("Guardrail override")) {
    return { icon: "⚠", color: "border-amber-400 bg-amber-50 text-amber-900" };
  }
  if (line.startsWith("Guardrail")) {
    return { icon: "✓", color: "border-emerald-400 bg-emerald-50 text-emerald-900" };
  }
  if (line.startsWith("Agent reasoning")) {
    return { icon: "✷", color: "border-violet-400 bg-violet-50 text-violet-900" };
  }
  return { icon: "•", color: "border-slate-300 bg-slate-50 text-slate-700" };
}
