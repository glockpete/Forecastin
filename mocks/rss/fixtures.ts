/**
 * RSS Feed Mock Fixtures
 *
 * Purpose: Test RSS ingestion without live feeds
 * Includes: Canonical feeds, edge cases, malformed XML
 *
 * Usage:
 * ```typescript
 * import { canonicalRSSFeed, malformedDateFeed } from '@/mocks/rss/fixtures';
 * ```
 */

export interface RSSItem {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author?: string;
  categories?: string[];
  guid?: string;
  source?: {
    name: string;
    url: string;
  };
}

export interface RSSFeed {
  title: string;
  link: string;
  description: string;
  language?: string;
  lastBuildDate?: string;
  items: RSSItem[];
}

// ============================================================================
// CANONICAL RSS FEED
// ============================================================================

export const canonicalRSSFeed: RSSFeed = {
  title: 'Geopolitical Intelligence Feed',
  link: 'https://example.com/feed',
  description: 'Latest geopolitical intelligence updates',
  language: 'en-us',
  lastBuildDate: '2025-11-06T12:00:00Z',
  items: [
    {
      id: 'rss_001',
      title: 'New Trade Agreement Announced',
      link: 'https://example.com/article/trade-agreement-2025',
      description: 'Major trade agreement between US and EU includes technology provisions.',
      pubDate: '2025-11-06T10:00:00Z',
      author: 'John Analyst',
      categories: ['trade', 'policy', 'technology'],
      guid: 'trade-agreement-001',
      source: {
        name: 'Global Policy Monitor',
        url: 'https://example.com',
      },
    },
    {
      id: 'rss_002',
      title: 'Emerging Market Forecast Update',
      link: 'https://example.com/article/emerging-markets-q4',
      description: 'Q4 forecast shows growth in Asian emerging markets.',
      pubDate: '2025-11-06T09:30:00Z',
      author: 'Jane Economist',
      categories: ['markets', 'forecast', 'asia'],
      guid: 'emerging-markets-002',
    },
  ],
};

// ============================================================================
// EDGE CASES
// ============================================================================

/**
 * Duplicate items by different criteria
 * Tests: Deduplication logic
 */
export const duplicateFeed: RSSFeed = {
  title: 'Duplicate Test Feed',
  link: 'https://example.com/feed',
  description: 'Contains duplicate items',
  items: [
    {
      id: 'rss_dup_001',
      title: 'Same Title',
      link: 'https://example.com/article/same-1',
      description: 'First version',
      pubDate: '2025-11-06T10:00:00Z',
      guid: 'article-001',
    },
    {
      id: 'rss_dup_002',
      title: 'Same Title',  // Duplicate title, different link
      link: 'https://example.com/article/same-2',
      description: 'Second version',
      pubDate: '2025-11-06T10:05:00Z',
      guid: 'article-001',  // Same GUID (should be considered duplicate)
    },
    {
      id: 'rss_dup_003',
      title: 'Different Title',
      link: 'https://example.com/article/same-1',  // Same link as first
      description: 'Third version',
      pubDate: '2025-11-06T10:10:00Z',
      guid: 'article-003',
    },
  ],
};

/**
 * Invalid and malformed dates
 * Tests: Date parsing resilience
 */
export const malformedDateFeed: RSSFeed = {
  title: 'Malformed Date Feed',
  link: 'https://example.com/feed',
  description: 'Contains invalid date formats',
  items: [
    {
      id: 'rss_date_001',
      title: 'Invalid RFC822 Date',
      link: 'https://example.com/article/1',
      description: 'Article with invalid date',
      pubDate: 'not a real date',
    },
    {
      id: 'rss_date_002',
      title: 'Missing Date',
      link: 'https://example.com/article/2',
      description: 'Article without date',
      pubDate: '',
    },
    {
      id: 'rss_date_003',
      title: 'Future Date',
      link: 'https://example.com/article/3',
      description: 'Article from the future',
      pubDate: '2099-12-31T23:59:59Z',
    },
    {
      id: 'rss_date_004',
      title: 'Unix Timestamp',
      link: 'https://example.com/article/4',
      description: 'Article with unix timestamp',
      pubDate: '1730899200',  // Should be RFC822 or ISO8601
    },
  ],
};

/**
 * Missing required fields
 * Tests: Validation and fallbacks
 */
export const missingFieldsFeed: RSSFeed = {
  title: 'Missing Fields Feed',
  link: 'https://example.com/feed',
  description: 'Contains items with missing fields',
  items: [
    {
      id: 'rss_missing_001',
      title: '',  // Missing title
      link: 'https://example.com/article/1',
      description: 'Article without title',
      pubDate: '2025-11-06T10:00:00Z',
    },
    {
      id: 'rss_missing_002',
      title: 'No Link',
      link: '',  // Missing link
      description: 'Article without link',
      pubDate: '2025-11-06T10:00:00Z',
    },
    {
      id: 'rss_missing_003',
      title: 'No Description',
      link: 'https://example.com/article/3',
      description: '',  // Missing description
      pubDate: '2025-11-06T10:00:00Z',
    },
  ],
};

/**
 * HTML entities and special characters
 * Tests: HTML entity decoding
 */
export const htmlEntitiesFeed: RSSFeed = {
  title: 'HTML Entities Feed',
  link: 'https://example.com/feed',
  description: 'Contains HTML entities',
  items: [
    {
      id: 'rss_html_001',
      title: 'Article with &quot;Quotes&quot; &amp; Entities',
      link: 'https://example.com/article/1',
      description: 'Description with &lt;b&gt;HTML&lt;/b&gt; tags and &copy; symbol',
      pubDate: '2025-11-06T10:00:00Z',
    },
    {
      id: 'rss_html_002',
      title: 'Unicode Characters: 中文 Français العربية',
      link: 'https://example.com/article/2',
      description: 'Multi-language content with emoji 🌍',
      pubDate: '2025-11-06T10:00:00Z',
    },
  ],
};

/**
 * Very large feed
 * Tests: Memory and performance handling
 */
export const largeFeed: RSSFeed = {
  title: 'Large Feed',
  link: 'https://example.com/feed',
  description: 'Contains many items',
  items: Array.from({ length: 1000 }, (_, i) => ({
    id: `rss_large_${i.toString().padStart(4, '0')}`,
    title: `Article ${i}: ${Math.random().toString(36).substring(7)}`,
    link: `https://example.com/article/${i}`,
    description: `Description for article ${i}. `.repeat(10),  // ~250 chars
    pubDate: new Date(Date.now() - i * 3600000).toISOString(),  // 1 hour apart
    categories: ['test', 'performance', `category_${i % 10}`],
  })),
};

/**
 * Feed with collision in deduplication
 * Tests: Hash collision handling
 */
export const collisionFeed: RSSFeed = {
  title: 'Collision Feed',
  link: 'https://example.com/feed',
  description: 'Items that might cause hash collisions',
  items: [
    {
      id: 'rss_coll_001',
      title: 'Article A',
      link: 'https://example.com/article/a',
      description: 'Content A',
      pubDate: '2025-11-06T10:00:00Z',
    },
    {
      id: 'rss_coll_002',
      title: 'Article A ',  // Same title with trailing space
      link: 'https://example.com/article/a',
      description: 'Content A',
      pubDate: '2025-11-06T10:00:00Z',
    },
  ],
};

// ============================================================================
// RAW XML SAMPLES (for XML parser testing)
// ============================================================================

export const validRSSXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Geopolitical Intelligence Feed</title>
    <link>https://example.com/feed</link>
    <description>Latest geopolitical intelligence updates</description>
    <item>
      <title>New Trade Agreement Announced</title>
      <link>https://example.com/article/trade-agreement-2025</link>
      <description>Major trade agreement between US and EU</description>
      <pubDate>Wed, 06 Nov 2025 10:00:00 GMT</pubDate>
      <guid>trade-agreement-001</guid>
    </item>
  </channel>
</rss>`;

export const malformedXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Malformed Feed</title>
    <link>https://example.com/feed
    <description>Missing closing tags
    <item>
      <title>Unclosed item
      <link>https://example.com/article/1</link>
`;

export const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
    <link>https://example.com/feed</link>
    <description>No items</description>
  </channel>
</rss>`;

// ============================================================================
// COLLECTION EXPORTS
// ============================================================================

export const validFeeds = [
  canonicalRSSFeed,
];

export const adversarialFeeds = [
  duplicateFeed,
  malformedDateFeed,
  missingFieldsFeed,
  htmlEntitiesFeed,
  largeFeed,
  collisionFeed,
];

export const xmlSamples = {
  valid: validRSSXML,
  malformed: malformedXML,
  empty: emptyFeed,
};

export const allRSSFixtures = {
  feeds: [...validFeeds, ...adversarialFeeds],
  xml: xmlSamples,
};
