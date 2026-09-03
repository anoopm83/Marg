// Minimal real auth: userID + hashed password, opaque session tokens.
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const hash = (pw: string) => bcrypt.hashSync(pw, 10);
export const verify = (pw: string, h: string) => bcrypt.compareSync(pw, h);
export const newToken = () => randomBytes(24).toString("hex");

const getSession = db.prepare("SELECT user_id FROM sessions WHERE token = ?");

export interface AuthedRequest extends Request {
  userId?: string;
}

export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  const row = token ? (getSession.get(token) as { user_id: string } | undefined) : undefined;
  if (!row) return res.status(401).json({ error: "unauthorized" });
  req.userId = row.user_id;
  next();
}
