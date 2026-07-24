import bcrypt from 'bcryptjs';
import { prisma, memoryStore, safeDb, logger } from '../config/db.js';
import { generateAnonymousName } from '../utils/anonymousNames.js';
import { moderateContent } from '../services/geminiModeration.js';
import { sendWelcomeEmail, sendResetCodeEmail } from '../services/emailService.js';

// AUTH CONTROLLER
function generateRecoveryKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `SABHA-${part1}-${part2}`;
}

export async function authenticate(req, res) {
  try {
    const { email, password, username, avatar, bio, college, mode } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Check user existence to enforce explicit login/signup modes if specified
    if (mode === 'login' || mode === 'signup') {
      const existingUser = await safeDb(
        () => prisma.user.findUnique({ where: { email } }),
        () => memoryStore.users.find(x => x.email === email) || null
      );

      if (mode === 'login' && !existingUser) {
        return res.status(404).json({ error: 'Delegate email not registered. Please sign up first!' });
      }

      if (mode === 'signup' && existingUser) {
        return res.status(400).json({ error: 'Delegate email already registered. Please log in!' });
      }
    }

    const user = await safeDb(
      async () => {
        let u = await prisma.user.findUnique({ where: { email } });
        if (u) {
          if (password && u.password) {
            const isValid = await bcrypt.compare(password, u.password);
            if (!isValid) throw new Error('INVALID_PASSWORD');
          }
        } else {
          const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
          const assignedUsername = username && username.trim() !== '' ? username.trim() : generateAnonymousName(email);
          const isExplicitAdmin = email.trim().toLowerCase() === 'admin@adesh.com';
          const generatedRecoveryKey = generateRecoveryKey();
          u = await prisma.user.create({
            data: {
              email,
              password: hashedPassword,
              anonymousName: assignedUsername,
              avatar: avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
              bio: bio || 'Delegate sitting on the Cockroach Sabha Floor.',
              college: college || null,
              role: isExplicitAdmin ? 'ADMIN' : 'USER',
              recoveryKey: generatedRecoveryKey,
            },
          });
        }
        return u;
      },
      async () => {
        let u = memoryStore.users.find(x => x.email === email);
        if (u) {
          if (password && u.password) {
            const isValid = await bcrypt.compare(password, u.password);
            if (!isValid) throw new Error('INVALID_PASSWORD');
          }
        } else {
          const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
          const assignedUsername = username && username.trim() !== '' ? username.trim() : generateAnonymousName(email);
          const isExplicitAdmin = email.trim().toLowerCase() === 'admin@adesh.com';
          const generatedRecoveryKey = generateRecoveryKey();
          u = {
            id: 'user-' + Date.now(),
            email,
            password: hashedPassword,
            anonymousName: assignedUsername,
            avatar: avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
            bio: bio || 'Delegate sitting on the Cockroach Sabha Floor.',
            college: college || null,
            role: isExplicitAdmin ? 'ADMIN' : 'USER',
            isBanned: false,
            createdAt: new Date(),
            recoveryKey: generatedRecoveryKey,
          };
          memoryStore.users.push(u);
        }
        return u;
      }
    );

    // Trigger welcome email asynchronously upon successful signup
    if (mode === 'signup') {
      sendWelcomeEmail(email, user.anonymousName, user.recoveryKey).catch(err => {
        logger.error(err, 'Failed to send welcome email');
      });
    }

    // Sanitize user object to exclude sensitive fields (password, raw email hash)
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

    return res.json({ user: sanitizedUser, token: user.id, recoveryKey: user.recoveryKey });
  } catch (err) {
    if (err.message === 'INVALID_PASSWORD') {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    logger.error(err, 'Auth error');
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// POSTS CONTROLLERS
export async function getUserPosts(req, res, user) {
  try {
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const userPosts = await safeDb(
      () => prisma.post.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, anonymousName: true, avatar: true, college: true } },
          _count: { select: { comments: true, reports: true } },
        },
      }),
      () => memoryStore.posts.filter(p => p.userId === user.id).map(p => ({
        ...p,
        user: p.user || { id: user.id, anonymousName: user.anonymousName, avatar: user.avatar, college: user.college },
        _count: p._count || { comments: (p.comments || []).length, reports: 0 }
      }))
    );

    return res.json(userPosts);
  } catch (err) {
    logger.error(err, 'getUserPosts error');
    return res.status(500).json({ error: "Failed to fetch delegate's posts" });
  }
}

export async function getPosts(req, res) {
  try {
    const { category, college } = req.query;
    const posts = await safeDb(
      async () => {
        const where = { status: 'APPROVED' };
        if (category) where.category = String(category);
        if (college) where.college = String(college);

        return await prisma.post.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, anonymousName: true, avatar: true, college: true } },
            _count: { select: { comments: true, reports: true } },
          },
        });
      },
      () => {
        let filtered = memoryStore.posts.filter(p => p.status === 'APPROVED');
        if (category) filtered = filtered.filter(p => p.category === category);
        if (college) filtered = filtered.filter(p => p.college === college);
        return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    );

    return res.json(posts);
  } catch (err) {
    logger.error(err, 'Error fetching posts');
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
}

export async function createPost(req, res, user) {
  try {
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.isBanned) return res.status(403).json({ error: 'Account is banned' });

    const { content, image, category, college } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content cannot be empty' });
    }
    if (content.length > 300) {
      return res.status(400).json({ error: 'Content exceeds 300 characters limit' });
    }
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const moderation = await moderateContent(content);

    const post = await safeDb(
      async () => {
        return await prisma.post.create({
          data: {
            content,
            image: image || null,
            category,
            college: college || user.college || null,
            status: moderation.status,
            userId: user.id,
          },
          include: {
            user: { select: { id: true, anonymousName: true, avatar: true, college: true } },
          },
        });
      },
      () => {
        const newPost = {
          id: 'post-' + Date.now(),
          content,
          image: image || null,
          category,
          college: college || user.college || null,
          status: moderation.status,
          createdAt: new Date(),
          userId: user.id,
          user: { id: user.id, anonymousName: user.anonymousName, avatar: user.avatar, college: user.college },
          comments: [],
          reports: [],
          _count: { comments: 0, reports: 0 }
        };
        memoryStore.posts.unshift(newPost);
        return newPost;
      }
    );

    return res.status(201).json({
      post,
      message: moderation.status === 'APPROVED' ? 'Post published' : 'Post submitted for review',
    });
  } catch (err) {
    logger.error(err, 'Error creating post');
    return res.status(500).json({ error: 'Failed to create post' });
  }
}

export async function getPostById(req, res) {
  try {
    const post = await safeDb(
      () => prisma.post.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, anonymousName: true, avatar: true, college: true } },
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, anonymousName: true, avatar: true } } },
          },
        },
      }),
      () => memoryStore.posts.find(p => p.id === req.params.id) || null
    );

    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.json(post);
  } catch (err) {
    return res.status(500).json({ error: 'Error loading post' });
  }
}

// COMMENTS CONTROLLER
export async function createComment(req, res, user) {
  try {
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.isBanned) return res.status(403).json({ error: 'Account is banned' });

    const { postId, content } = req.body;
    if (!postId || !content) return res.status(400).json({ error: 'Missing postId or content' });

    const comment = await safeDb(
      () => prisma.comment.create({
        data: { postId, content, userId: user.id },
        include: { user: { select: { id: true, anonymousName: true, avatar: true } } },
      }),
      () => {
        const c = {
          id: 'c-' + Date.now(),
          content,
          createdAt: new Date(),
          postId,
          userId: user.id,
          user: { id: user.id, anonymousName: user.anonymousName, avatar: user.avatar }
        };
        const p = memoryStore.posts.find(x => x.id === postId);
        if (p) {
          p.comments.push(c);
          p._count.comments = p.comments.length;
        }
        return c;
      }
    );

    return res.status(201).json(comment);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add comment' });
  }
}

// REPORT CONTROLLER
export async function createReport(req, res, user) {
  try {
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { postId, reason } = req.body;
    if (!postId || !reason) return res.status(400).json({ error: 'Post ID and reason required' });

    const report = await safeDb(
      () => prisma.report.create({
        data: { postId, reason, userId: user.id },
      }),
      () => {
        const r = { id: 'r-' + Date.now(), postId, reason, userId: user.id, createdAt: new Date() };
        memoryStore.reports.push(r);
        return r;
      }
    );

    return res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit report' });
  }
}

// ADMIN CONTROLLERS
export async function getAdminPosts(req, res) {
  try {
    const { status } = req.query;
    const posts = await safeDb(
      async () => {
        const where = {};
        if (status) where.status = String(status);
        return await prisma.post.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, anonymousName: true, email: true, isBanned: true } },
            _count: { select: { reports: true } },
          },
        });
      },
      () => {
        if (status) return memoryStore.posts.filter(p => p.status === status);
        return memoryStore.posts;
      }
    );
    return res.json(posts);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch admin posts' });
  }
}

export async function getAdminReports(req, res) {
  try {
    const reports = await safeDb(
      () => prisma.report.findMany({
        orderBy: { createdAt: 'desc' },
        include: { post: true, user: { select: { id: true, anonymousName: true } } },
      }),
      () => memoryStore.reports
    );
    return res.json(reports);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
}

export async function getAdminUsers(req, res) {
  try {
    const users = await safeDb(
      () => prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, anonymousName: true, role: true, isBanned: true, createdAt: true },
      }),
      () => memoryStore.users
    );
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function updatePostStatus(req, res) {
  try {
    const { status } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const post = await safeDb(
      () => prisma.post.update({ where: { id: req.params.id }, data: { status } }),
      () => {
        const p = memoryStore.posts.find(x => x.id === req.params.id);
        if (p) p.status = status;
        return p;
      }
    );
    return res.json({ message: `Post status updated to ${status}`, post });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update post status' });
  }
}

export async function banUser(req, res) {
  try {
    const user = await safeDb(
      () => prisma.user.update({ where: { id: req.params.id }, data: { isBanned: true } }),
      () => {
        const u = memoryStore.users.find(x => x.id === req.params.id);
        if (u) u.isBanned = true;
        return u;
      }
    );
    return res.json({ message: 'User has been banned', user });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to ban user' });
  }
}

export async function updateProfile(req, res, user) {
  try {
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { bio, college } = req.body;

    const updatedUser = await safeDb(
      () => prisma.user.update({
        where: { id: user.id },
        data: {
          bio: bio !== undefined ? bio : user.bio,
          college: college !== undefined ? college : user.college,
        },
      }),
      () => {
        const u = memoryStore.users.find(x => x.id === user.id);
        if (u) {
          if (bio !== undefined) u.bio = bio;
          if (college !== undefined) u.college = college;
        }
        return u;
      }
    );

    return res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function deletePost(req, res, user) {
  try {
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const existingPost = await safeDb(
      () => prisma.post.findUnique({ where: { id } }),
      () => memoryStore.posts.find(p => p.id === id)
    );

    if (!existingPost) {
      return res.status(404).json({ error: 'Motion not found' });
    }

    // Only post author or ADMIN can delete
    if (existingPost.userId !== user.id && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You are not authorized to withdraw this motion' });
    }

    await safeDb(
      () => prisma.post.delete({ where: { id } }),
      () => {
        memoryStore.posts = memoryStore.posts.filter(p => p.id !== id);
      }
    );

    logger.info({ postId: id, userId: user.id }, 'Motion withdrawn/deleted successfully');
    return res.json({ message: 'Motion withdrawn from Sabha Floor successfully' });
  } catch (err) {
    logger.error(err, 'Error deleting post');
    return res.status(500).json({ error: 'Failed to delete motion' });
  }
}

// GET SYSTEM STATS (API CALLS & UNIQUE VISITORS)
export async function getStats(req, res) {
  try {
    const stats = await safeDb(
      async () => {
        const totalApiCalls = await prisma.apiLog.count();
        const uniqueGroup = await prisma.apiLog.groupBy({
          by: ['ipHash'],
        });
        const uniqueVisitors = uniqueGroup.length;

        const pathsGroup = await prisma.apiLog.groupBy({
          by: ['path'],
          _count: { path: true },
        });
        const apiCallsByPath = pathsGroup
          .map(item => ({
            path: item.path,
            count: item._count.path,
          }))
          .sort((a, b) => b.count - a.count);

        return { totalApiCalls, uniqueVisitors, apiCallsByPath };
      },
      () => {
        const logs = memoryStore.apiLogs || [];
        const totalApiCalls = logs.length;
        const uniqueVisitors = new Set(logs.map(l => l.ipHash)).size;

        const pathCounts = {};
        logs.forEach(l => {
          pathCounts[l.path] = (pathCounts[l.path] || 0) + 1;
        });

        const apiCallsByPath = Object.entries(pathCounts)
          .map(([path, count]) => ({
            path,
            count,
          }))
          .sort((a, b) => b.count - a.count);

        return { totalApiCalls, uniqueVisitors, apiCallsByPath };
      }
    );

    return res.json(stats);
  } catch (err) {
    logger.error(err, 'Error fetching stats');
    return res.status(500).json({ error: 'Failed to fetch API stats' });
  }
}

// REQUEST PASSWORD RESET CODE
export async function requestResetCode(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await safeDb(
      () => prisma.user.findUnique({ where: { email } }),
      () => memoryStore.users.find(u => u.email === email) || null
    );

    if (!user) {
      return res.status(404).json({ error: 'Delegate email not registered.' });
    }

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await safeDb(
      () => prisma.user.update({
        where: { email },
        data: { resetCode: code, resetCodeExpires: expires }
      }),
      () => {
        user.resetCode = code;
        user.resetCodeExpires = expires;
      }
    );

    // Send reset code email
    await sendResetCodeEmail(email, code);

    return res.json({ message: 'A 6-digit confirmation passcode has been sent to your email.' });
  } catch (err) {
    logger.error(err, 'Request reset code error');
    return res.status(500).json({ error: 'Failed to request reset passcode' });
  }
}

// RESET PASSWORD VIA RECOVERY KEY OR EMAIL RESET CODE
export async function resetPassword(req, res) {
  try {
    const { email, recoveryKey, code, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Missing email or newPassword' });
    }
    if (!recoveryKey && !code) {
      return res.status(400).json({ error: 'Provide either recoveryKey or confirmation code' });
    }

    const user = await safeDb(
      () => prisma.user.findUnique({ where: { email } }),
      () => memoryStore.users.find(u => u.email === email) || null
    );

    if (!user) {
      return res.status(404).json({ error: 'Delegate email not found' });
    }

    // 1. Verify code if code is supplied
    if (code) {
      if (!user.resetCode || user.resetCode.trim() !== code.trim()) {
        return res.status(401).json({ error: 'Incorrect passcode' });
      }
      if (user.resetCodeExpires && new Date(user.resetCodeExpires) < new Date()) {
        return res.status(401).json({ error: 'Confirmation passcode has expired' });
      }
    }

    // 2. Verify recovery key if recovery key is supplied (fallback)
    if (recoveryKey && !code) {
      if (!user.recoveryKey || user.recoveryKey.trim().toLowerCase() !== recoveryKey.trim().toLowerCase()) {
        return res.status(401).json({ error: 'Incorrect recovery key' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await safeDb(
      () => prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          resetCode: null,
          resetCodeExpires: null
        }
      }),
      () => {
        user.password = hashedPassword;
        user.resetCode = null;
        user.resetCodeExpires = null;
      }
    );

    logger.info({ email }, 'Password reset successfully');
    return res.json({ message: 'Password reset successful! You can now log in using your new password.' });
  } catch (err) {
    logger.error(err, 'Reset password error');
    return res.status(500).json({ error: 'Failed to reset password' });
  }
}
