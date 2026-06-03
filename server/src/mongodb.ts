import { MongoClient, type Db, type Collection } from "mongodb";

export interface ChatMessage {
  id?:           string;
  senderId:       string;
  senderUsername: string;
  recipientId:    string;
  recipientUsername?: string;
  text:           string;
  createdAt:      Date;
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(url: string): Promise<void> {
  client = new MongoClient(url);
  await client.connect();
  db = client.db(); // uses db name from connection string
  console.log("🍃  MongoDB connected");
}

export function getMessages(): Collection<ChatMessage> {
  if (!db) throw new Error("MongoDB not connected");
  return db.collection<ChatMessage>("messages");
}

/** Fetch DM history between two users, oldest first. */
export async function getChatHistory(
  userId1: string,
  userId2: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const col = getMessages();
  return col
    .find({
      $or: [
        { senderId: userId1, recipientId: userId2 },
        { senderId: userId2, recipientId: userId1 },
      ],
    })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray()
    .then((docs) => docs.map(({ id, senderId, senderUsername, recipientId, recipientUsername, text, createdAt }) => ({
      id, senderId, senderUsername, recipientId, recipientUsername, text, createdAt,
    })));
}

/** Save a message to MongoDB. */
export async function saveMessage(msg: ChatMessage): Promise<void> {
  const col = getMessages();
  await col.insertOne({ ...msg });
}

/** Get the most recent conversation partners for a user. */
export async function getRecentPartners(userId: string): Promise<string[]> {
  const col = getMessages();
  const docs = await col
    .find({ $or: [{ senderId: userId }, { recipientId: userId }] })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const seen = new Set<string>();
  for (const d of docs) {
    const other = d.senderId === userId ? d.recipientId : d.senderId;
    seen.add(other);
  }
  return [...seen];
}

/** Get the most recent conversation partners with usernames for a user. */
export async function getRecentPartnersWithNames(userId: string, limit = 200) {
  const col = getMessages();
  const docs = await col
    .find({ $or: [{ senderId: userId }, { recipientId: userId }] })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  const seen = new Set<string>();
  const result: { id: string; username: string }[] = [];

  for (const d of docs) {
    const otherId = d.senderId === userId ? d.recipientId : d.senderId;
    if (seen.has(otherId)) continue;
    const username =
      d.senderId === userId
        ? d.recipientUsername ?? otherId
        : d.senderUsername ?? otherId;
    seen.add(otherId);
    result.push({ id: otherId, username });
  }

  return result;
}

/** Get the most recent conversation partners with usernames for a user (by user ID or username). */
export async function getRecentPartnersWithNamesForUser(
  userId: string,
  username: string,
  limit = 200,
) {
  const col = getMessages();
  const docs = await col
    .find({
      $or: [
        { senderId: userId },
        { recipientId: userId },
        { senderUsername: username },
        { recipientUsername: username },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  const seen = new Set<string>();
  const result: { id: string; username: string }[] = [];

  for (const d of docs) {
    const isSender = d.senderId === userId || d.senderUsername === username;
    const otherId = isSender ? d.recipientId : d.senderId;
    if (!otherId || seen.has(otherId)) continue;
    const otherUsername = isSender
      ? d.recipientUsername ?? d.senderUsername
      : d.senderUsername ?? d.recipientUsername;
    if (otherId === userId || otherUsername === username) continue;
    seen.add(otherId);
    result.push({ id: otherId, username: otherUsername ?? "Unknown user" });
  }

  return result;
}
