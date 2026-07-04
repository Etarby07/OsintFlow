// Client-side helper to persist an investigation into the local history DB.
export interface HistoryPayload {
  tool: string;
  query: string;
  results: unknown;
}

export async function saveHistory(payload: HistoryPayload): Promise<boolean> {
  try {
    const res = await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
