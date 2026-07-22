import Parser from 'rss-parser';
import { prisma, memoryStore, safeDb, logger } from '../config/db.js';

const parser = new Parser({
  customFields: {
    item: ['description', 'content:encoded', 'media:content']
  }
});

// Official RSS Feeds for The Hindu & PIB India
export const RSS_FEEDS = [
  {
    name: 'The Hindu National',
    url: 'https://www.thehindu.com/news/national/feeder/default.rss',
    category: 'Lok Sabha Debates'
  },
  {
    name: 'The Hindu Opinion',
    url: 'https://www.thehindu.com/opinion/feeder/default.rss',
    category: 'Constitution & Fundamental Rights'
  },
  {
    name: 'PIB National News',
    url: 'https://pib.gov.in/RssMain.aspx?ModId=6',
    category: 'Youth & Electoral Reform'
  }
];

// Helper: Format raw RSS item to a clean Gazette Motion Object (DRY)
export function formatRssItemToMotion(item, sourceName, category) {
  const rawTitle = item.title || '';
  const rawDesc = item.snippet || item.contentSnippet || item.description || '';
  
  if (!rawTitle || rawTitle.trim().length < 10) return null;

  const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, '').trim();
  const combinedText = `${rawTitle}\n\n${cleanDesc.slice(0, 140)}${cleanDesc.length > 140 ? '...' : ''}`;
  
  return {
    id: 'rss-' + Math.random().toString(36).substring(2, 9),
    content: combinedText.slice(0, 290),
    category: category || 'Lok Sabha Debates',
    college: 'Central Vista Corridor',
    status: 'APPROVED',
    createdAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    userId: 'speaker-admin-id',
    user: {
      id: 'speaker-admin-id',
      anonymousName: `📰 ${sourceName} Gazette`,
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=hindunews',
      college: 'Press Gallery & Media Lounge'
    },
    comments: [],
    reports: [],
    _count: { comments: 0, reports: 0 }
  };
}

// Hourly Fetching: Max 50 Posts per Hour Limit (DRY & Production Optimized)
export async function fetchAndSyncNews() {
  logger.info('Running Hourly RSS Sync (Max 50 posts/hr limit)...');
  let fetchedMotions = [];
  const MAX_POSTS_PER_HOUR = 50;

  for (const feedConfig of RSS_FEEDS) {
    if (fetchedMotions.length >= MAX_POSTS_PER_HOUR) break;

    try {
      const feed = await parser.parseURL(feedConfig.url);
      if (feed && feed.items) {
        // Distribute quota across feeds
        const quotaPerFeed = Math.ceil(MAX_POSTS_PER_HOUR / RSS_FEEDS.length);
        for (const item of feed.items.slice(0, quotaPerFeed)) {
          if (fetchedMotions.length >= MAX_POSTS_PER_HOUR) break;

          const motion = formatRssItemToMotion(item, feedConfig.name, feedConfig.category);
          if (motion) {
            fetchedMotions.push(motion);
          }
        }
      }
    } catch (err) {
      logger.warn({ feed: feedConfig.name, error: err.message }, 'Failed to fetch RSS feed, retaining existing floor data');
    }
  }

  if (fetchedMotions.length > 0) {
    // 1. Memory Store Sync (DRY)
    const existingContents = new Set(memoryStore.posts.map(p => p.content));
    const newMotions = fetchedMotions.filter(m => !existingContents.has(m.content));
    
    if (newMotions.length > 0) {
      memoryStore.posts = [...newMotions, ...memoryStore.posts].slice(0, 200); // Keep memory store lean for production
    }

    // 2. PostgreSQL / SQLite Sync (DRY)
    safeDb(async () => {
      let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (!adminUser) return;
      
      for (const m of newMotions) {
        const exists = await prisma.post.findFirst({ where: { content: m.content } });
        if (!exists) {
          await prisma.post.create({
            data: {
              content: m.content,
              category: m.category,
              college: m.college,
              status: 'APPROVED',
              userId: adminUser.id,
              createdAt: m.createdAt,
            }
          });
        }
      }
    }, () => {});
  }

  logger.info({ syncedCount: fetchedMotions.length }, 'Hourly RSS sync complete');
  return fetchedMotions;
}
