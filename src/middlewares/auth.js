import { prisma, memoryStore, safeDb } from '../config/db.js';

export async function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: token } });
    if (dbUser) return dbUser;
  } catch (err) {
    // Fall back to memory store on DB connection errors
  }
  
  return memoryStore.users.find(u => u.id === token) || null;
}
