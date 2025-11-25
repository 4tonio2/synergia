import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth + medical roles
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Medical role field - one of: infirmier, medecin, kinesitherapeute, aidant_pro
  medicalRole: varchar("medical_role"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const updateUserRoleSchema = z.object({
  medicalRole: z.enum(["infirmier", "medecin", "kinesitherapeute", "aidant_pro"]),
});

export const updateUserProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  medicalRole: z.enum(["infirmier", "medecin", "kinesitherapeute", "aidant_pro"]).optional(),
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type UpdateUserRole = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type User = typeof users.$inferSelect;

// Medical role type for frontend use
export type MedicalRole = "infirmier" | "medecin" | "kinesitherapeute" | "aidant_pro";

// Authentication logs table for RGPD compliance
export const authLogs = pgTable("auth_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: varchar("action").notNull(), // "login", "logout", "role_change", "profile_update"
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  metadata: jsonb("metadata"), // Additional context like old/new role
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const createAuthLogSchema = z.object({
  userId: z.string(),
  action: z.enum(["login", "logout", "role_change", "profile_update"]),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type AuthLog = typeof authLogs.$inferSelect;
export type CreateAuthLog = z.infer<typeof createAuthLogSchema>;

// Patients table
export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id), // Professional who manages this patient
  name: varchar("name").notNull(),
  age: varchar("age"),
  address: varchar("address"),
  phoneNumber: varchar("phone_number"),
  medicalTags: jsonb("medical_tags").$type<string[]>().default(sql`'[]'`), // ["Diabète", "AVK", etc.]
  riskLevel: varchar("risk_level"), // "Faible", "Modéré", "Élevé"
  audioConsent: varchar("audio_consent"), // "oral", "written", "refused", null
  audioConsentDate: timestamp("audio_consent_date"),
  nextVisitTime: varchar("next_visit_time"), // Format "HH:MM" for scheduling
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const createPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Patient = typeof patients.$inferSelect;
export type CreatePatient = z.infer<typeof createPatientSchema>;

// Visits/Recordings table
export const visits = pgTable("visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id), // Professional who created the visit
  patientId: varchar("patient_id").references(() => patients.id), // Can be null for free recordings
  visitDate: timestamp("visit_date").notNull(),
  durationSeconds: varchar("duration_seconds"),
  audioFileUrl: varchar("audio_file_url"), // URL to stored audio file
  transcription: varchar("transcription", { length: 10000 }), // Full transcription from IA
  aiSummary: varchar("ai_summary", { length: 5000 }), // AI-generated summary
  visitType: varchar("visit_type"), // "Surveillance", "Soin", "Consultation", etc.
  painLevel: varchar("pain_level"), // 0-10
  vitalSigns: varchar("vital_signs"), // "Tension normale, Saturation 98%"
  alerts: jsonb("alerts").$type<{id: string, level: string, description: string, actionRequired: boolean}[]>().default(sql`'[]'`),
  riskLevel: varchar("risk_level"), // "Faible", "Modéré", "Élevé"
  validated: varchar("validated").default('false'), // "true" or "false" as string
  processing: varchar("processing").default('false'), // "true" or "false" as string
  notes: varchar("notes", { length: 5000 }), // Additional notes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const createVisitSchema = createInsertSchema(visits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Visit = typeof visits.$inferSelect;
export type CreateVisit = z.infer<typeof createVisitSchema>;

// Alerts table
export const alertsTable = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  patientId: varchar("patient_id").references(() => patients.id),
  visitId: varchar("visit_id").references(() => visits.id),
  level: varchar("level").notNull(), // "Faible", "Modéré", "Élevé"
  description: varchar("description", { length: 1000 }).notNull(),
  actionRequired: varchar("action_required").default('false'), // "true" or "false"
  isRead: varchar("is_read").default('false'), // "true" or "false"
  createdAt: timestamp("created_at").defaultNow(),
});

export const createAlertSchema = createInsertSchema(alertsTable).omit({
  id: true,
  createdAt: true,
});

export type Alert = typeof alertsTable.$inferSelect;
export type CreateAlert = z.infer<typeof createAlertSchema>;
