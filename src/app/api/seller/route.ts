import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sellerGDDetails, sellerQRCodes, sellerUploadSummary, fleekRecords, qrCodes } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { pool } from "@/db";
import QRCode from "qrcode";

function makeBatchStamp() {
  return `${new Date().toISOString()}__${Math.random().toString(36).slice(2, 10)}`;
}

function groupSellerRows<T extends { fleekId: string; pieces: string | null; boxNo: string; createdAt: string }>(rows: T[]) {
  const map = new Map<string, T & { fleekId: string; pieces: string | null }>();
  for (const row of rows) {
    const key = `${row.createdAt}__${row.boxNo}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, fleekId: row.fleekId, pieces: row.pieces || "" });
      continue;
    }
    const ids = existing.fleekId.split(",").map((x) => x.trim()).filter(Boolean);
    if (!ids.includes(row.fleekId)) ids.push(row.fleekId);
    const pcs = String(existing.pieces || "").split(",").map((x) => x.trim()).filter(Boolean);
    pcs.push(row.pieces || "");
    map.set(key, { ...existing, fleekId: ids.join(", "), pieces: pcs.join(", ") });
  }
  return Array.from(map.values());
}

async function insertGDDetail(
  sellerId: number,
  sellerName: string,
  sellerEmail: string,
  vendor: string,
  fleekId: string,
  pieces: string,
  boxNo: string,
  weight: string,
  height: string,
  len: string,
  width: string,
  dimWeight: string,
  uploadDate: string,
  createdAt?: string,
) {
  const now = createdAt || new Date().toISOString();
  await pool.query(
    `INSERT INTO seller_gd_details 
    (seller_id, seller_name, seller_email, vendor, fleek_id, pieces, box_no, weight, height, "length", width, dimensional_weight, upload_date, assigned_3pl, assigned_at, assigned_by, received_status, received_at, received_by, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [sellerId, sellerName, sellerEmail, vendor, fleekId, pieces, boxNo, weight, height, len, width, dimWeight, uploadDate, '', '', '', '', '', '', now]
  );
}

async function insertSummary(
  sellerId: number, sellerName: string, vendor: string, uploadDate: string,
  totalOrders: number, totalBoxes: number
) {
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO seller_upload_summary 
    (seller_id, seller_name, vendor, upload_date, total_orders, total_boxes, assigned_3pl, assigned_at, assigned_by, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [sellerId, sellerName, vendor, uploadDate, totalOrders, totalBoxes, '', '', '', now]
  );
}

async function insertQRCode(
  sellerId: number, sellerName: string, vendor: string,
  fleekId: string, qrImageData: string, uploadDate: string
) {
  const now = new Date().toISOString();
  
  // 1. Insert into seller's QR codes table (for seller's view)
  await pool.query(
    `INSERT INTO seller_qr_codes 
    (seller_id, seller_name, vendor, fleek_id, qr_image_data, upload_date, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [sellerId, sellerName, vendor, fleekId, qrImageData, uploadDate, now]
  );
  
  // 2. ALSO insert into main qr_codes table (PERMANENT for Fleek tool)
  // This ensures Fleek side always has the QR codes even if seller data gets cleaned
  const fleekIdNormalized = fleekId.toUpperCase().replace(/[^A-Z0-9]/g, "");
  try {
    await db.insert(qrCodes).values({
      fleekId: fleekId,
      fleekIdNormalized: fleekIdNormalized,
      qrImageData: qrImageData,
      source: "seller",
      sellerName: sellerName,
      createdAt: now,
    });
  } catch (err) {
    // If duplicate or error, just log - seller QR is still saved
    console.log("Note: QR may already exist in main table or column not ready:", fleekId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || currentUser.role !== "seller") {
      return NextResponse.json({ error: "Seller access only" }, { status: 403 });
    }

    const body = await request.json();
    const { rows, type, orderEntry } = body as { 
      rows?: Record<string, string>[]; 
      type?: string;
      orderEntry?: {
        fleekId: string; pieces: string; boxNo: string; weight: string;
        height: string; length: string; width: string; dimensionalWeight: string;
      };
    };

    const today = new Date().toISOString().slice(0, 10);
    const vendor = currentUser.name;

    // ═══ SINGLE ORDER ENTRY ═══
    if (type === "order_entry" && orderEntry) {
      const { fleekId, pieces, boxNo, weight, height, length, width, dimensionalWeight } = orderEntry;
      if (!fleekId?.trim() || !boxNo?.trim()) {
        return NextResponse.json({ error: "Order ID and Box No are required" }, { status: 400 });
      }

      const singleCreatedAt = new Date().toISOString();
      await insertGDDetail(
        currentUser.id, currentUser.name, currentUser.email, vendor,
        fleekId.trim(), pieces?.trim() || "", boxNo.trim(), weight?.trim() || "",
        height?.trim() || "", length?.trim() || "", width?.trim() || "", dimensionalWeight?.trim() || "", today, singleCreatedAt
      );

      // Count today's totals
      const todayDetails = await db.select().from(sellerGDDetails)
        .where(and(eq(sellerGDDetails.sellerId, currentUser.id), eq(sellerGDDetails.vendor, vendor), eq(sellerGDDetails.uploadDate, today)));
      const uniqueOrders = new Set(todayDetails.map(d => d.fleekId)).size;
      const totalBoxes = todayDetails.length;

      // Upsert summary
      const existing = await db.select().from(sellerUploadSummary)
        .where(and(eq(sellerUploadSummary.sellerId, currentUser.id), eq(sellerUploadSummary.vendor, vendor), eq(sellerUploadSummary.uploadDate, today)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(sellerUploadSummary).set({ totalOrders: uniqueOrders, totalBoxes }).where(eq(sellerUploadSummary.id, existing[0].id));
      } else {
        await insertSummary(currentUser.id, currentUser.name, vendor, today, uniqueOrders, totalBoxes);
      }

      // QR code
      const existingQr = await db.select().from(sellerQRCodes)
        .where(and(eq(sellerQRCodes.sellerId, currentUser.id), eq(sellerQRCodes.fleekId, fleekId.trim()), eq(sellerQRCodes.uploadDate, today)))
        .limit(1);

      let qrImageData = "";
      if (existingQr.length === 0) {
        qrImageData = await QRCode.toDataURL(fleekId.trim(), { width: 300, margin: 2, color: { dark: "#000000", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
        await insertQRCode(currentUser.id, currentUser.name, vendor, fleekId.trim(), qrImageData, today);
      } else {
        qrImageData = existingQr[0].qrImageData;
      }

      const savedTime = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      return NextResponse.json({
        success: true,
        message: `Order ${fleekId} Box ${boxNo} saved at ${savedTime}!`,
        qrCode: { fleekId: fleekId.trim(), qrImageData },
        summary: { totalOrders: uniqueOrders, totalBoxes, date: today, vendor, timestamp: new Date().toISOString() },
      });
    }

    // ═══ BOX ENTRY (multi-order per box) ═══
    if (type === "box_entry" && body.boxData) {
      const { orders, boxNo, weight, height, length, width, dimensionalWeight } = body.boxData as {
        orders: Array<{ orderId: string; pieces: string }>;
        boxNo: string; weight: string; height: string; length: string; width: string; dimensionalWeight: string;
      };

      if (!orders || orders.length === 0 || !boxNo?.trim()) {
        return NextResponse.json({ error: "Orders and Box No required" }, { status: 400 });
      }

      // Insert each order as a row (same box details, same createdAt so UI can group them)
      const boxCreatedAt = makeBatchStamp();
      for (const order of orders) {
        if (!order.orderId?.trim()) continue;
        await insertGDDetail(
          currentUser.id, currentUser.name, currentUser.email, vendor,
          order.orderId.trim(), order.pieces?.trim() || "", boxNo.trim(),
          weight?.trim() || "", height?.trim() || "", length?.trim() || "",
          width?.trim() || "", dimensionalWeight?.trim() || "", today, boxCreatedAt
        );
      }

      // Update summary
      const todayDetails = await db.select().from(sellerGDDetails)
        .where(and(eq(sellerGDDetails.sellerId, currentUser.id), eq(sellerGDDetails.vendor, vendor), eq(sellerGDDetails.uploadDate, today)));
      const uniqueOrders = new Set(todayDetails.map(d => d.fleekId)).size;
      const totalBoxes = todayDetails.length;

      const existing = await db.select().from(sellerUploadSummary)
        .where(and(eq(sellerUploadSummary.sellerId, currentUser.id), eq(sellerUploadSummary.vendor, vendor), eq(sellerUploadSummary.uploadDate, today)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(sellerUploadSummary).set({ totalOrders: uniqueOrders, totalBoxes }).where(eq(sellerUploadSummary.id, existing[0].id));
      } else {
        await insertSummary(currentUser.id, currentUser.name, vendor, today, uniqueOrders, totalBoxes);
      }

      // Generate 1 QR per box - combine all order IDs
      const orderIds = orders.filter(o => o.orderId?.trim()).map(o => o.orderId.trim());
      const qrLabel = orderIds.join(",");

      const existingQr = await db.select().from(sellerQRCodes)
        .where(and(eq(sellerQRCodes.sellerId, currentUser.id), eq(sellerQRCodes.fleekId, qrLabel), eq(sellerQRCodes.uploadDate, today)))
        .limit(1);

      let qrImageData = "";
      if (existingQr.length === 0) {
        qrImageData = await QRCode.toDataURL(qrLabel, { width: 300, margin: 2, color: { dark: "#000000", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
        await insertQRCode(currentUser.id, currentUser.name, vendor, qrLabel, qrImageData, today);
      } else {
        qrImageData = existingQr[0].qrImageData;
      }

      const boxSavedTime = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      return NextResponse.json({
        success: true,
        message: `Box ${boxNo} saved with ${orderIds.length} order(s) at ${boxSavedTime}!`,
        qrCode: { fleekId: qrLabel, qrImageData },
        summary: { totalOrders: uniqueOrders, totalBoxes, date: today, vendor, timestamp: new Date().toISOString() },
      });
    }

    // ═══ CSV UPLOAD ═══
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No data rows provided" }, { status: 400 });
    }

    const orderBoxMap = new Map<string, number>();
    const validRows: Array<{ fleekId: string; pieces: string; boxNo: string; weight: string; height: string; len: string; width: string; dimWeight: string; createdAt: string }> = [];
    const multiOrderBoxes: string[] = [];

    for (const row of rows) {
      const rawFleekId = (row.fleek_id || row.fleekId || row["Fleek ID"] || row["fleek id"] || row["Order ID"] || row["order_id"] || row["order id"] || "").trim();
      const boxNo = (row.box_no || row.boxNo || row["Box no"] || row["Box No"] || row["box no"] || row["Box"] || row["box"] || "").trim();
      if (!rawFleekId || !boxNo) continue;

      const rawPieces = (row.pieces || row.Pieces || row.pcs || row.Pcs || "").trim();
      const weight = (row.weight || row.Weight || row.wt || row.Wt || "").trim();
      const height = (row.height || row.Height || row.h || row.H || "").trim();
      const len = (row.length || row.Length || row.l || row.L || "").trim();
      const width = (row.width || row.Width || row.w || row.W || "").trim();
      const dimWeight = (row.dimensional_weight || row.dimensionalWeight || row["Dimensional Weight"] || row["dim_weight"] || row["Dim Weight"] || row["dim weight"] || "").trim();

      // Handle comma-separated order IDs (multi-order in one box)
      const fleekIds = rawFleekId.split(",").map((s: string) => s.trim()).filter((s: string) => s);
      const piecesArr = rawPieces.split(",").map((s: string) => s.trim());
      const rowCreatedAt = makeBatchStamp();

      for (let fi = 0; fi < fleekIds.length; fi++) {
        const fleekId = fleekIds[fi];
        const pieces = piecesArr[fi] || "";
        orderBoxMap.set(fleekId, (orderBoxMap.get(fleekId) || 0) + 1);
        validRows.push({ fleekId, boxNo, pieces, weight, height, len, width, dimWeight, createdAt: rowCreatedAt });
      }

      // If multi-order, track the combined key for QR
      if (fleekIds.length > 1) {
        multiOrderBoxes.push(fleekIds.join(","));
      }
    }

    if (validRows.length === 0) {
      return NextResponse.json({ error: "No valid rows. CSV needs 'Fleek ID' and 'Box no' columns." }, { status: 400 });
    }

    // Insert one by one with parameterized queries
    for (const r of validRows) {
      await insertGDDetail(
        currentUser.id, currentUser.name, currentUser.email, vendor,
        r.fleekId, r.pieces, r.boxNo, r.weight, r.height, r.len, r.width, r.dimWeight, today, r.createdAt
      );
    }

    const totalOrders = orderBoxMap.size;
    const totalBoxes = validRows.length;

    // Upsert summary
    const existing = await db.select().from(sellerUploadSummary)
      .where(and(eq(sellerUploadSummary.sellerId, currentUser.id), eq(sellerUploadSummary.vendor, vendor), eq(sellerUploadSummary.uploadDate, today)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(sellerUploadSummary).set({
        totalOrders: existing[0].totalOrders + totalOrders,
        totalBoxes: existing[0].totalBoxes + totalBoxes,
      }).where(eq(sellerUploadSummary.id, existing[0].id));
    } else {
      await insertSummary(currentUser.id, currentUser.name, vendor, today, totalOrders, totalBoxes);
    }

    // QR codes - individual per order + combined for multi-order boxes
    const uniqueFleekIds = Array.from(orderBoxMap.keys());
    const qrCodesGenerated: Array<{ fleekId: string; qrImageData: string }> = [];

    // Generate individual QR for single orders
    for (const fleekId of uniqueFleekIds) {
      // Skip if this order is part of a multi-order box (combined QR will be generated)
      if (multiOrderBoxes.some(m => m.includes(fleekId))) continue;

      const existingQr = await db.select().from(sellerQRCodes)
        .where(and(eq(sellerQRCodes.sellerId, currentUser.id), eq(sellerQRCodes.fleekId, fleekId), eq(sellerQRCodes.uploadDate, today)))
        .limit(1);

      if (existingQr.length === 0) {
        const qrDataUrl = await QRCode.toDataURL(fleekId, { width: 300, margin: 2, color: { dark: "#000000", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
        await insertQRCode(currentUser.id, currentUser.name, vendor, fleekId, qrDataUrl, today);
        qrCodesGenerated.push({ fleekId, qrImageData: qrDataUrl });
      } else {
        qrCodesGenerated.push({ fleekId, qrImageData: existingQr[0].qrImageData });
      }
    }

    // Generate combined QR for multi-order boxes (1 QR per box)
    for (const combined of multiOrderBoxes) {
      const existingQr = await db.select().from(sellerQRCodes)
        .where(and(eq(sellerQRCodes.sellerId, currentUser.id), eq(sellerQRCodes.fleekId, combined), eq(sellerQRCodes.uploadDate, today)))
        .limit(1);

      if (existingQr.length === 0) {
        const qrDataUrl = await QRCode.toDataURL(combined, { width: 300, margin: 2, color: { dark: "#000000", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
        await insertQRCode(currentUser.id, currentUser.name, vendor, combined, qrDataUrl, today);
        qrCodesGenerated.push({ fleekId: combined, qrImageData: qrDataUrl });
      } else {
        qrCodesGenerated.push({ fleekId: combined, qrImageData: existingQr[0].qrImageData });
      }
    }

    return NextResponse.json({
      success: true,
      summary: { totalOrders, totalBoxes, date: today, vendor, timestamp: new Date().toISOString() },
      qrCodes: qrCodesGenerated,
      message: `${totalOrders} orders, ${totalBoxes} boxes uploaded at ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`,
    });
  } catch (error) {
    console.error("Seller upload error:", error);
    const msg = error instanceof Error ? error.message : "Unknown";
    return NextResponse.json({ error: "Server error: " + msg.slice(0, 300) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser || !["seller", "admin", "manager"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const searchParam = request.nextUrl.searchParams.get("search");
    const dateFromParam = request.nextUrl.searchParams.get("dateFrom");
    const dateToParam = request.nextUrl.searchParams.get("dateTo");
    const vendorParam = request.nextUrl.searchParams.get("vendor");
    const today = new Date().toISOString().slice(0, 10);

    if (searchParam) {
      const term = searchParam.trim().replace(/\//g, "_");
      const results = await db.select().from(fleekRecords)
        .where(ilike(fleekRecords.fleekIdNormalized, `%${term}%`))
        .limit(5);
      return NextResponse.json({
        searchResults: results.map(r => ({
          fleekId: r.fleekId, latestStatus: r.latestStatus, vendor: r.vendor, customerName: r.customerName,
        })),
      });
    }

    // Fleek team (admin/manager) sees ALL sellers, Seller sees ALL own data
    const isFleek = ["admin", "manager"].includes(currentUser.role);
    const isSeller = currentUser.role === "seller";
    
    // Date range - both admin and seller can filter
    const dateFrom = dateFromParam || "";  // Empty = no lower limit
    const dateTo = dateToParam || today;   // Default to today

    // Build conditions for summaries
    let summaryConditions;
    if (isFleek) {
      // Admin: filter by date range, optionally by vendor
      const conditions = [];
      if (dateFrom) conditions.push(sql`${sellerUploadSummary.uploadDate} >= ${dateFrom}`);
      if (dateTo) conditions.push(sql`${sellerUploadSummary.uploadDate} <= ${dateTo}`);
      if (vendorParam && vendorParam !== "all") {
        conditions.push(eq(sellerUploadSummary.vendor, vendorParam));
      }
      summaryConditions = conditions.length > 0 ? and(...conditions) : sql`1=1`;
    } else if (isSeller) {
      // Seller: ALL own data with optional date filter
      const conditions = [eq(sellerUploadSummary.sellerId, currentUser.id)];
      if (dateFrom) conditions.push(sql`${sellerUploadSummary.uploadDate} >= ${dateFrom}`);
      if (dateTo) conditions.push(sql`${sellerUploadSummary.uploadDate} <= ${dateTo}`);
      summaryConditions = and(...conditions);
    } else {
      summaryConditions = sql`1=0`; // No access
    }

    const summaries = await db.select().from(sellerUploadSummary)
      .where(summaryConditions)
      .orderBy(desc(sellerUploadSummary.createdAt));

    // Build conditions for QR codes
    let qrConditions;
    if (isFleek) {
      const conditions = [];
      if (dateFrom) conditions.push(sql`${sellerQRCodes.uploadDate} >= ${dateFrom}`);
      if (dateTo) conditions.push(sql`${sellerQRCodes.uploadDate} <= ${dateTo}`);
      if (vendorParam && vendorParam !== "all") {
        conditions.push(eq(sellerQRCodes.vendor, vendorParam));
      }
      qrConditions = conditions.length > 0 ? and(...conditions) : sql`1=1`;
    } else if (isSeller) {
      // Seller: ALL own QR codes with optional date filter
      const conditions = [eq(sellerQRCodes.sellerId, currentUser.id)];
      if (dateFrom) conditions.push(sql`${sellerQRCodes.uploadDate} >= ${dateFrom}`);
      if (dateTo) conditions.push(sql`${sellerQRCodes.uploadDate} <= ${dateTo}`);
      qrConditions = and(...conditions);
    } else {
      qrConditions = sql`1=0`;
    }

    const allQrCodes = await db.select().from(sellerQRCodes)
      .where(qrConditions)
      .orderBy(desc(sellerQRCodes.createdAt));
    // No 24hr limit anymore - show all QR codes
    const validQrCodes = allQrCodes;

    // Build conditions for details
    let detailConditions;
    if (isFleek) {
      const conditions = [];
      if (dateFrom) conditions.push(sql`${sellerGDDetails.uploadDate} >= ${dateFrom}`);
      if (dateTo) conditions.push(sql`${sellerGDDetails.uploadDate} <= ${dateTo}`);
      if (vendorParam && vendorParam !== "all") {
        conditions.push(eq(sellerGDDetails.vendor, vendorParam));
      }
      detailConditions = conditions.length > 0 ? and(...conditions) : sql`1=1`;
    } else if (isSeller) {
      // Seller: ALL own details with optional date filter
      const conditions = [eq(sellerGDDetails.sellerId, currentUser.id)];
      if (dateFrom) conditions.push(sql`${sellerGDDetails.uploadDate} >= ${dateFrom}`);
      if (dateTo) conditions.push(sql`${sellerGDDetails.uploadDate} <= ${dateTo}`);
      detailConditions = and(...conditions);
    } else {
      detailConditions = sql`1=0`;
    }

    const details = await db.select().from(sellerGDDetails)
      .where(detailConditions)
      .orderBy(desc(sellerGDDetails.createdAt));

    // History: admin sees all, seller sees own
    const history = await db.select().from(sellerUploadSummary)
      .where(isFleek ? sql`1=1` : eq(sellerUploadSummary.sellerId, currentUser.id))
      .orderBy(desc(sellerUploadSummary.uploadDate))
      .limit(200);

    // Get unique vendors for admin filter dropdown
    const allVendorsRaw = isFleek 
      ? await db.select({ vendor: sellerGDDetails.vendor }).from(sellerGDDetails)
      : [];
    const allVendors = [...new Set(allVendorsRaw.map(v => v.vendor))].sort();

    // Get unique dates for filter (seller sees own dates, admin sees all)
    const allDatesRaw = isFleek
      ? await db.select({ uploadDate: sellerGDDetails.uploadDate }).from(sellerGDDetails)
      : isSeller 
        ? await db.select({ uploadDate: sellerGDDetails.uploadDate }).from(sellerGDDetails).where(eq(sellerGDDetails.sellerId, currentUser.id))
        : [];
    const allDates = [...new Set(allDatesRaw.map(d => d.uploadDate))].sort().reverse();

    return NextResponse.json({ 
      summaries, 
      qrCodes: validQrCodes, 
      details, 
      history, 
      currentDate: today, 
      vendor: currentUser.name,
      // Filter data for dropdowns
      allVendors: isFleek ? allVendors : [],
      allDates: allDates, // Both admin and seller get their dates
      filters: { dateFrom, dateTo, vendor: vendorParam || "all" }
    });
  } catch (error) {
    console.error("Seller data error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE - Delete a seller GD entry (admin or own seller)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = await request.json();
    const { entryId } = body as { entryId: number };

    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }

    // Only admin can delete
    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Admin access only" }, { status: 403 });
    }
    await pool.query("DELETE FROM seller_gd_details WHERE id = $1", [entryId]);

    // No summary recalc needed - admin delete is rare

    return NextResponse.json({ success: true, message: "Entry deleted" });
  } catch (error) {
    console.error("Delete seller entry error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
