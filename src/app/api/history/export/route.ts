import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TOOL_LABELS: Record<string, string> = {
  user: "Búsqueda de Usuario",
  email: "Análisis de Email",
  ipdomain: "IP y Dominio",
  phone: "Teléfono",
  exif: "Metadatos EXIF",
};

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get("format") ?? "json";
    const tool = req.nextUrl.searchParams.get("tool");
    const where = tool && tool !== "all" ? { tool } : undefined;
    const items = await db.investigation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    if (format === "csv") {
      const header = ["id", "tool", "toolLabel", "query", "createdAt", "results"];
      const rows = items.map((i) =>
        [
          i.id,
          i.tool,
          TOOL_LABELS[i.tool] ?? i.tool,
          i.query,
          i.createdAt.toISOString(),
          i.results,
        ]
          .map(escapeCsv)
          .join(",")
      );
      const csv = [header.join(","), ...rows].join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="osintflow-history-${Date.now()}.csv"`,
        },
      });
    }

    // JSON export (default)
    const payload = {
      exportedAt: new Date().toISOString(),
      count: items.length,
      investigations: items.map((i) => ({
        id: i.id,
        tool: i.tool,
        toolLabel: TOOL_LABELS[i.tool] ?? i.tool,
        query: i.query,
        results: safeJson(i.results),
        createdAt: i.createdAt.toISOString(),
      })),
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="osintflow-history-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
