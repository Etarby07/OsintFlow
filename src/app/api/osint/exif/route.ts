import { NextRequest, NextResponse } from "next/server";
import exifr from "exifr";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No se ha enviado ningún archivo." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract everything: EXIF, IPTC, XMP, ICC, JFIF + GPS in one pass.
    let metadata: Record<string, unknown> = {};
    try {
      metadata = (await exifr.parse(buffer, {
        tiff: true,
        exif: true,
        gps: true,
        iptc: true,
        xmp: true,
        icc: true,
        jfif: true,
        ifd0: true,
        ifd1: true,
        exifIfd: true,
        mergeOutput: true,
        reviveValues: true,
      })) as Record<string, unknown>;
    } catch {
      metadata = {};
    }

    if (!metadata || Object.keys(metadata).length === 0) {
      // Try a simpler parse as fallback (some files only have basic EXIF).
      try {
        metadata = (await exifr.parse(buffer, true)) as Record<string, unknown>;
      } catch {
        metadata = {};
      }
    }

    // Remove large binary thumbnail buffers if present.
    delete (metadata as Record<string, unknown>).Thumbnail;
    delete (metadata as Record<string, unknown>).thumbnail;
    delete (metadata as Record<string, unknown>).ImageSize;

    // Normalize GPS coordinates.
    let gps: { lat?: number; lon?: number; url?: string } | undefined;
    const lat = (metadata.latitude ?? metadata.lat ?? metadata.GPSLatitude) as
      | number
      | undefined;
    const lon = (metadata.longitude ?? metadata.lon ?? metadata.GPSLongitude) as
      | number
      | undefined;
    if (typeof lat === "number" && typeof lon === "number") {
      gps = {
        lat,
        lon,
        url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`,
      };
      // Replace raw lat/lon fields with cleaner names if present.
      delete metadata.latitude;
      delete metadata.longitude;
      metadata.GPSLatitude = lat;
      metadata.GPSLongitude = lon;
    }

    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "image/unknown",
      metadata,
      gps,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
