export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    candidates.unshift(fenced[1].trim());
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    candidates.push(trimmed.slice(first, last + 1));
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to parse JSON from model output");
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "content" in item) {
        return String((item as { content: unknown }).content).trim();
      }
      return String(item).trim();
    })
    .filter(Boolean);
}

export function asDecisions(value: unknown): {
  category: string;
  value: string;
  rationale?: string;
}[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        const [category, ...rest] = item.split(":");
        return {
          category: (category ?? "decision").trim(),
          value: rest.join(":").trim() || item.trim(),
        };
      }
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const category = String(rec.category ?? rec.key ?? rec.area ?? "decision");
        const val = String(rec.value ?? rec.choice ?? rec.technology ?? rec.name ?? "");
        const rationale =
          typeof rec.rationale === "string" ? rec.rationale : undefined;
        return { category, value: val, rationale };
      }
      return { category: "decision", value: String(item) };
    })
    .filter((d) => d.category && d.value);
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}
