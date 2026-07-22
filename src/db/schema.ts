import { pgTable, serial, text, boolean, integer, jsonb } from "drizzle-orm/pg-core";

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
  source: text("source").default("fleek"), // "fleek" or "seller" - tracks where QR was created
  sellerName: text("seller_name"), // if source is seller, store seller name
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  plainPassword: text("plain_password"),
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
  photoUrl: text("photo_url"),
  status: text("status").notNull().default("received"),
  scannedAt: text("scanned_at").notNull().$defaultFn(() => new Date().toISOString()),
});

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

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  details: text("details"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const extraItems = pgTable("extra_items", {
  id: serial("id").primaryKey(),
  fleekId: text("fleek_id"),
  description: text("description").notNull(),
  photoUrl: text("photo_url"),
  reportedById: serial("reported_by_id").notNull(),
  reportedByName: text("reported_by_name").notNull(),
  reportedByRole: text("reported_by_role").notNull(),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  reviewedBy: text("reviewed_by"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  reviewedAt: text("reviewed_at"),
});

// ═══════════════════════════════════════════════════════════════════════════
// SELLER GD DETAILS - ALL nullable columns have .default(sql`NULL`)
// ═══════════════════════════════════════════════════════════════════════════
export const sellerGDDetails = pgTable("seller_gd_details", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull(),
  sellerName: text("seller_name").notNull(),
  sellerEmail: text("seller_email").notNull(),
  vendor: text("vendor").notNull(),
  fleekId: text("fleek_id").notNull(),
  pieces: text("pieces").default(""),
  boxNo: text("box_no").notNull(),
  weight: text("weight").default(""),
  height: text("height").default(""),
  length: text("length").default(""),
  width: text("width").default(""),
  dimensionalWeight: text("dimensional_weight").default(""),
  uploadDate: text("upload_date").notNull(),
  assigned3pl: text("assigned_3pl").default(""),
  assignedAt: text("assigned_at").default(""),
  assignedBy: text("assigned_by").default(""),
  receivedStatus: text("received_status").default(""),
  receivedAt: text("received_at").default(""),
  receivedBy: text("received_by").default(""),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const sellerQRCodes = pgTable("seller_qr_codes", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull(),
  sellerName: text("seller_name").notNull(),
  vendor: text("vendor").notNull(),
  fleekId: text("fleek_id").notNull(),
  qrImageData: text("qr_image_data").notNull(),
  uploadDate: text("upload_date").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const sellerUploadSummary = pgTable("seller_upload_summary", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull(),
  sellerName: text("seller_name").notNull(),
  vendor: text("vendor").notNull(),
  uploadDate: text("upload_date").notNull(),
  totalOrders: integer("total_orders").notNull(),
  totalBoxes: integer("total_boxes").notNull(),
  assigned3pl: text("assigned_3pl").default(""),
  assignedAt: text("assigned_at").default(""),
  assignedBy: text("assigned_by").default(""),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════════════════
// USER PERMISSIONS - Per-user tab access control
// ═══════════════════════════════════════════════════════════════════════════
export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  permissions: jsonb("permissions").notNull().$type<Record<string, boolean>>(),
  updatedBy: text("updated_by"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS - In-app notification system
// ═══════════════════════════════════════════════════════════════════════════
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "order_received", "seller_upload", "new_user", "access_request"
  title: text("title").notNull(),
  message: text("message").notNull(),
  icon: text("icon").default("bell"), // icon name
  link: text("link"), // optional tab to navigate to
  targetRoles: text("target_roles"), // comma-separated roles who should see this, null = all
  readBy: text("read_by").default(""), // comma-separated user IDs who read it
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
