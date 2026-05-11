"use server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Pings the database to verify connectivity.
 */
export async function pingDb(): Promise<boolean> {
  try {
    const res = await redis.ping();
    return res === "PONG";
  } catch (error) {
    console.error("Upstash Ping Failed:", error);
    return false;
  }
}

/**
 * Fetch all items for a collection (from a Redis Hash)
 */
export async function getAllDb<T>(collectionName: string): Promise<T[]> {
  try {
    const data = await redis.hgetall<Record<string, T>>(`asrs:${collectionName}`);
    if (!data) return [];
    return Object.values(data);
  } catch (error) {
    console.error(`Upstash getAllDb(${collectionName}) Failed:`, error);
    throw new Error("Failed to fetch from Upstash");
  }
}

/**
 * Upsert an item into a collection
 */
export async function upsertDb<T extends { id?: string }>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  try {
    await redis.hset(`asrs:${collectionName}`, { [id]: data });
  } catch (error) {
    console.error(`Upstash upsertDb(${collectionName}, ${id}) Failed:`, error);
    throw new Error("Failed to upsert to Upstash");
  }
}

/**
 * Remove an item from a collection
 */
export async function removeDb(collectionName: string, id: string): Promise<void> {
  try {
    await redis.hdel(`asrs:${collectionName}`, id);
  } catch (error) {
    console.error(`Upstash removeDb(${collectionName}, ${id}) Failed:`, error);
    throw new Error("Failed to remove from Upstash");
  }
}

/**
 * Set a singleton config object
 */
export async function setConfigDb<T>(key: string, data: T): Promise<void> {
  try {
    await redis.set(`asrs:${key}`, data);
  } catch (error) {
    console.error(`Upstash setConfigDb(${key}) Failed:`, error);
    throw new Error("Failed to set config in Upstash");
  }
}

/**
 * Get a singleton config object
 */
export async function getConfigDb<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(`asrs:${key}`);
    return data;
  } catch (error) {
    console.error(`Upstash getConfigDb(${key}) Failed:`, error);
    throw new Error("Failed to get config from Upstash");
  }
}
