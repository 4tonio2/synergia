import { storage } from "./storage";
import type { Request } from "express";

export async function logAuthEvent(
  userId: string,
  action: "login" | "logout" | "role_change" | "profile_update",
  req: Request,
  metadata?: Record<string, any>
) {
  try {
    const ipAddress = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      undefined;
    
    const userAgent = req.headers['user-agent'] || undefined;

    await storage.createAuthLog({
      userId,
      action,
      ipAddress,
      userAgent,
      metadata,
    });

    console.log(`[AUTH-LOG] ${action} for user ${userId} from ${ipAddress}`);
  } catch (error) {
    console.error(`[AUTH-LOG] Failed to log ${action}:`, error);
    // Don't throw - logging failure shouldn't break the main flow
  }
}
