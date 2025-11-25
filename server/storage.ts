import {
  users,
  authLogs,
  type User,
  type UpsertUser,
  type UpdateUserRole,
  type UpdateUserProfile,
  type CreateAuthLog,
  type AuthLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Medical role operations
  updateUserRole(userId: string, roleData: UpdateUserRole): Promise<User>;
  
  // Profile update operation
  updateUserProfile(userId: string, profileData: UpdateUserProfile): Promise<User>;
  
  // Auth log operations (RGPD compliance)
  createAuthLog(logData: CreateAuthLog): Promise<AuthLog>;
  getUserAuthLogs(userId: string, limit?: number): Promise<AuthLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserRole(userId: string, roleData: UpdateUserRole): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        medicalRole: roleData.medicalRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async updateUserProfile(userId: string, profileData: UpdateUserProfile): Promise<User> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (profileData.firstName !== undefined) {
      updateData.firstName = profileData.firstName;
    }
    if (profileData.lastName !== undefined) {
      updateData.lastName = profileData.lastName;
    }
    if (profileData.medicalRole !== undefined) {
      updateData.medicalRole = profileData.medicalRole;
    }

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async createAuthLog(logData: CreateAuthLog): Promise<AuthLog> {
    const [log] = await db
      .insert(authLogs)
      .values(logData)
      .returning();
    
    return log;
  }

  async getUserAuthLogs(userId: string, limit: number = 50): Promise<AuthLog[]> {
    const logs = await db
      .select()
      .from(authLogs)
      .where(eq(authLogs.userId, userId))
      .orderBy(desc(authLogs.timestamp))
      .limit(limit);
    
    return logs;
  }
}

export const storage = new DatabaseStorage();
