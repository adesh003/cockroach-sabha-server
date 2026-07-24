import { PrismaClient } from '@prisma/client';
import pino from 'pino';

export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
export const prisma = new PrismaClient();

// Authentic Indian Political News, UPSC Debates, and Citizen Petitions Seed Data
export const memoryStore = {
  users: [
    {
      id: 'speaker-admin-id',
      email: 'admin@adesh.com',
      anonymousName: '🏛 Speaker of the House',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=speaker',
      bio: 'Official Office of the Speaker — Cockroach Sabha Floor Administrator',
      college: 'Lok Sabha (Lower House)',
      role: 'ADMIN',
      isBanned: false,
      createdAt: new Date(),
    },
    {
      id: 'upsc-veteran-id',
      email: 'upsc.aspirant@sabha.in',
      anonymousName: '📜 UPSC 4th Attempt Veteran #402',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=upsc',
      bio: 'Pre-cleared 2 times. Fighting for exam transparency & age relaxation.',
      college: 'Central Vista Corridor',
      role: 'USER',
      isBanned: false,
      createdAt: new Date(),
    },
    {
      id: 'neta-analyst-id',
      email: 'chai.analyst@sabha.in',
      anonymousName: '☕ Senior Chai Stall Analyst #901',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=chai',
      bio: 'Analyzing Indian Electoral Debates one kulhad chai at a time.',
      college: 'Corner Chai Stall Parliament',
      role: 'USER',
      isBanned: false,
      createdAt: new Date(),
    }
  ],
  posts: [
    {
      id: 'motion-pol-101',
      content: '🚨 BREAKING LOK SABHA MOTION: The delay in UPSC CSE Prelims scorecard release & lack of answer key transparency before mains must be investigated by a Supreme Court Constitution bench!',
      image: null,
      category: 'Unemployment & UPSC',
      college: 'Lok Sabha (Lower House)',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 1800000),
      userId: 'upsc-veteran-id',
      user: { 
        id: 'upsc-veteran-id', 
        anonymousName: '📜 UPSC 4th Attempt Veteran #402', 
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=upsc', 
        college: 'Central Vista Corridor' 
      },
      comments: [
        {
          id: 'arg-101',
          content: '100% supported! Millions of youth spend 5+ years in Old Rajinder Nagar with zero feedback on cutoffs.',
          createdAt: new Date(Date.now() - 900000),
          user: { id: 'neta-analyst-id', anonymousName: '☕ Senior Chai Stall Analyst #901', avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=chai' }
        }
      ],
      reports: [],
      _count: { comments: 1, reports: 0 }
    },
    {
      id: 'motion-pol-102',
      content: '☕ CHAI PE CHARCHA: Why are middle-class salaried taxpayers in India paying 30% income tax while getting zero social security or pothole-free roads? Parliament must debate tax rebates for youth!',
      image: null,
      category: 'Chai Pe Charcha',
      college: 'Corner Chai Stall Parliament',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 5400000),
      userId: 'neta-analyst-id',
      user: { 
        id: 'neta-analyst-id', 
        anonymousName: '☕ Senior Chai Stall Analyst #901', 
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=chai', 
        college: 'Corner Chai Stall Parliament' 
      },
      comments: [],
      reports: [],
      _count: { comments: 0, reports: 0 }
    },
    {
      id: 'motion-pol-103',
      content: '📜 CONSTITUTION BENCH MOTION: Free speech on college campuses and internet shutdown rules in India need strict judicial review under Article 19(1)(a).',
      image: null,
      category: 'Constitution & Fundamental Rights',
      college: 'Constitution Bench (Supreme Court)',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 10800000),
      userId: 'speaker-admin-id',
      user: { 
        id: 'speaker-admin-id', 
        anonymousName: '🏛 Speaker of the House', 
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=speaker', 
        college: 'Lok Sabha (Lower House)' 
      },
      comments: [],
      reports: [],
      _count: { comments: 0, reports: 0 }
    },
    {
      id: 'motion-pol-104',
      content: '🗳 YOUTH ELECTORAL REFORM: Voter turnout among 18-25 youth dropped in urban centers. We need online voter registration & mobile voting booths in major IT/University hubs.',
      image: null,
      category: 'Youth & Electoral Reform',
      college: 'Rajya Sabha (Upper House)',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 21600000),
      userId: 'upsc-veteran-id',
      user: { 
        id: 'upsc-veteran-id', 
        anonymousName: '📜 UPSC 4th Attempt Veteran #402', 
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=upsc', 
        college: 'Central Vista Corridor' 
      },
      comments: [],
      reports: [],
      _count: { comments: 0, reports: 0 }
    }
  ],
  comments: [],
  reports: [],
  apiLogs: []
};

// Safe DB execution wrapper with fallback
export async function safeDb(fn, fallbackFn) {
  try {
    return await fn();
  } catch (err) {
    logger.warn('PostgreSQL database unreachable. Using in-memory fallback store.');
    return fallbackFn();
  }
}
