import { prisma, memoryStore, safeDb } from '../config/db.js';

export async function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  return safeDb(
    () => prisma.user.findUnique({ where: { id: token } }),
    () => memoryStore.users.find(u => u.id === token) || null
  );
}
