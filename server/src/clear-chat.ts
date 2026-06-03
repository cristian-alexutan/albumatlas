import { MongoClient } from "mongodb";

const url = process.env.MONGODB_URL ?? "mongodb://localhost:27017/albumatlas";

const client = new MongoClient(url);
await client.connect();
const db = client.db();
const result = await db.collection("messages").deleteMany({});
console.log(`🗑️  Deleted ${result.deletedCount} chat messages.`);
await client.close();
