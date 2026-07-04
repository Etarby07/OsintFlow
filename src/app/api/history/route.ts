import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TOOL_LABELS: Record<string, string> = {
  user: "Búsqueda de Usuario",
  email: "Análisis de Email",
  ipdomain: "IP y Dominio",
  phone: "Teléfono",
  exif: "Metadatos EXIF",
};

export async function GET(req: NextRequest) {
  try {
    const tool = req.nextUrl.searchParams.get("tool");
    const where = tool && tool !== "all" ? { tool } : undefined;
    const items = await db.investigation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        tool: i.tool,
        toolLabel: TOOL_LABELS[i.tool] ?? i.tool,
        query: i.query,
        results: i.results,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tool = String(body?.tool ?? "").trim();
    const query = String(body?.query ?? "").trim();
    const results = body?.results;
    if (!tool || !query) {
      return NextResponse.json(
        { error: "tool y query son obligatorios" },
        { status: 400 }
      );
    }
    // Cap the stored payload to keep SQLite lightweight.
    const resultsStr = JSON.stringify(results).slice(0, 50000);
    const item = await db.investigation.create({
      data: { tool, query, results: resultsStr },
    });
    return NextResponse.json({ id: item.id, createdAt: item.createdAt.toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      await db.investigation.delete({ where: { id } });
      return NextResponse.json({ ok: true, deleted: id });
    }
    // No id => clear all
    await db.investigation.deleteMany({});
    return NextResponse.json({ ok: true, cleared: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
