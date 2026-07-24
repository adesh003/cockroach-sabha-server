import express from 'express';
import { getAuthUser } from '../middlewares/auth.js';
import * as api from '../controllers/apiController.js';

const router = express.Router();

// Auth
router.post('/auth', api.authenticate);
router.get('/users/me', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  const sanitizedUser = {
    id: user.id,
    anonymousName: user.anonymousName,
    avatar: user.avatar,
    bio: user.bio,
    college: user.college,
    delegateTag: user.delegateTag,
    role: user.role,
    createdAt: user.createdAt,
  };
  return res.json(sanitizedUser);
});
router.get('/users/me/posts', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return api.getUserPosts(req, res, user);
});
router.patch('/users/me', async (req, res) => {
  const user = await getAuthUser(req);
  return api.updateProfile(req, res, user);
});

// Posts
router.get('/posts', api.getPosts);
router.post('/posts', async (req, res) => {
  const user = await getAuthUser(req);
  return api.createPost(req, res, user);
});
router.get('/posts/:id', api.getPostById);
router.delete('/posts/:id', async (req, res) => {
  const user = await getAuthUser(req);
  return api.deletePost(req, res, user);
});

// Comments
router.post('/comments', async (req, res) => {
  const user = await getAuthUser(req);
  return api.createComment(req, res, user);
});

// Reports
router.post('/report', async (req, res) => {
  const user = await getAuthUser(req);
  return api.createReport(req, res, user);
});

// Admin Dashboard
router.get('/admin/posts', api.getAdminPosts);
router.patch('/admin/posts/:id/status', api.updatePostStatus);
router.post('/admin/users/:id/ban', api.banUser);
router.get('/admin/stats', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user || user.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return api.getStats(req, res);
});

export default router;
