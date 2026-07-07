import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ FLEEKTRACK DATABASE SCHEMA - DATA PRESERVATION POLICY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ALL DATA IS PERMANENT - NOTHING IS EVER DELETED:
 * 
 * 1. fleek_records  → CSV uploaded orders - ONLY new records added, existing NEVER modified/deleted
 * 2. qr_codes       → Generated QR codes - stored PERMANENTLY, never regenerated or deleted  
 * 3. users          → User accounts - NEVER deleted, only disabled (isActive = false)
 * 4. scan_logs      → Scan history - EVERY scan logged permanently, full audit trail
 * 
 * This is by design for:
 * - Complete audit trail
 * - Data integrity  
 * - Historical records preservation
 * - Compliance and accountability
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const fleekRecords = pgTable("fleek_records", {
  id: serial("id").primaryKey(),
  fleekId: text("fleek_id").notNull(),
  fleekIdNormalized: text("fleek_id_normalized").notNull().unique(),
  latestStatus: text("latest_status"),
  latestStatusDate: text("latest_status_date"),
  totalOrderLineAmount: text("total_order_line_amount"),
  customerCountry: text("customer_country"),
  vendor: text("vendor"),
  customerName: text("customer_name"),
  quantitySold: text("quantity_sold"),
  category: text("category"),
  receivedStatus: text("received_status"),
  receivedDate: text("received_date"),
  receivedBoxCount: text("received_box_count"),
  receivedBy: text("received_by"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const qrCodes = pgTable("qr_codes", {
  id: serial("id").primaryKey(),
  fleekId: text("fleek_id").notNull(),
  fleekIdNormalized: text("fleek_id_normalized").notNull(),
  qrImageData: text("qr_image_data").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("employee"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const scanLogs = pgTable("scan_logs", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  fleekId: text("fleek_id").notNull(),
  fleekIdNormalized: text("fleek_id_normalized").notNull(),
  boxCount: text("box_count"),
  notes: text("notes"),
  boxDetails: text("box_details"),
  status: text("status").notNull().default("received"),
  scannedAt: text("scanned_at").notNull().$defaultFn(() => new Date().toISOString()),
});

/**
 * Access Requests - users request access, admin/manager approves with role
 * Requests are NEVER deleted - status changes from "pending" to "approved"/"rejected"
 */
export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  assignedRole: text("assigned_role"),
  reviewedBy: text("reviewed_by"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  reviewedAt: text("reviewed_at"),
});
