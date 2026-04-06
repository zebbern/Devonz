/// <reference types="vitest/globals" />
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import * as schema from '~/lib/.server/db/schema';

/**
 * We test the API route handlers by importing the unwrapped handler logic.
 * Since the route file exports `loader` and `action` which are wrapped with
 * `withSecurity()`, we need to call them via their Remix signature.
 *
 * For isolation we mock `~/lib/.server/db` so it uses an in-memory database.
 */

// -- In-memory test database setup ------------------------------------------

function createTestDb() {
  const client = createClient({ url: ':memory:' });
  return drizzle(client, { schema });
}

async function migrateTestDb(testDb: ReturnType<typeof createTestDb>) {
  await testDb.run(sql`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      url_id TEXT UNIQUE,
      description TEXT,
      timestamp TEXT,
      metadata TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await testDb.run(sql`CREATE INDEX IF NOT EXISTS idx_chats_url_id ON chats(url_id)`);
  await testDb.run(sql`CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)`);
  await testDb.run(sql`CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at)`);
}

// Seed helper
async function seedChats(testDb: ReturnType<typeof createTestDb>, count: number) {
  for (let i = 1; i <= count; i++) {
    await testDb.insert(schema.chats).values({
      id: `chat-${String(i).padStart(3, '0')}`,
      description: `Chat number ${i}`,
      createdAt: new Date(Date.now() - (count - i) * 1000).toISOString(),
      updatedAt: new Date(Date.now() - (count - i) * 1000).toISOString(),
    });
  }
}

// We mock the db module so the route uses our in-memory instance
let testDb: ReturnType<typeof createTestDb>;

vi.mock('~/lib/.server/db', () => ({
  get db() {
    return testDb;
  },
  get schema() {
    return schema;
  },
}));

// Mock the logger to avoid noisy output
vi.mock('~/utils/logger', () => ({
  createScopedLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLevel: vi.fn(),
  }),
}));

// Import the route handlers AFTER the mocks are set up
const { loader, action } = await import('~/routes/api.db.chats');

/*
 * ---------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------
 */

function buildLoaderArgs(url: string) {
  const request = new Request(`http://localhost${url}`, { method: 'GET' });
  return { request, params: {}, context: {} as any, unstable_url: new URL(request.url), unstable_pattern: '' };
}

function buildActionArgs(body: unknown) {
  const request = new Request('http://localhost/api/db/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { request, params: {}, context: {} as any, unstable_url: new URL(request.url), unstable_pattern: '' };
}

/*
 * ---------------------------------------------------------------------------
 * Tests
 * ---------------------------------------------------------------------------
 */

describe('GET /api/db/chats', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await migrateTestDb(testDb);
  });

  it('returns an empty paginated list when no chats exist', async () => {
    const response = await loader(buildLoaderArgs('/api/db/chats'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.chats).toEqual([]);
    expect(data.pagination).toMatchObject({
      page: 1,
      total: 0,
      totalPages: 0,
    });
  });

  it('paginates results correctly', async () => {
    await seedChats(testDb, 25);

    // Page 1, default limit 20
    const res1 = await loader(buildLoaderArgs('/api/db/chats'));
    const data1 = await res1.json();
    expect(data1.chats).toHaveLength(20);
    expect(data1.pagination.total).toBe(25);
    expect(data1.pagination.totalPages).toBe(2);

    // Page 2
    const res2 = await loader(buildLoaderArgs('/api/db/chats?page=2'));
    const data2 = await res2.json();
    expect(data2.chats).toHaveLength(5);
    expect(data2.pagination.page).toBe(2);
  });

  it('respects custom limit parameter', async () => {
    await seedChats(testDb, 10);

    const response = await loader(buildLoaderArgs('/api/db/chats?limit=3&page=1'));
    const data = await response.json();
    expect(data.chats).toHaveLength(3);
    expect(data.pagination.limit).toBe(3);
    expect(data.pagination.totalPages).toBe(4); // ceil(10/3) = 4
  });
});

describe('POST /api/db/chats', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await migrateTestDb(testDb);
  });

  it('creates a new chat with a valid body', async () => {
    const body = {
      id: 'new-chat-1',
      description: 'My first chat',
      urlId: 'my-first-chat',
    };

    const response = await action(buildActionArgs(body));
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.chat).toBeDefined();
    expect(data.chat.id).toBe('new-chat-1');
    expect(data.chat.description).toBe('My first chat');
    expect(data.chat.urlId).toBe('my-first-chat');
  });

  it('returns 400 for missing required id field', async () => {
    const response = await action(buildActionArgs({ description: 'no id' }));
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid request');
    expect(data.details).toBeDefined();
    expect(data.details.length).toBeGreaterThan(0);
  });

  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/api/db/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    });
    const response = await action({
      request,
      params: {},
      context: {} as any,
      unstable_url: new URL(request.url),
      unstable_pattern: '',
    });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid JSON in request body');
  });
});

describe('DEVONZ_DB_PATH env var (via resolveDbUrl)', () => {
  /*
   * resolveDbUrl is a pure function that reads process.env.DEVONZ_DB_PATH
   * at call time. It lives in a side-effect-free module so we can import
   * it without triggering libsql client creation.
   */
  let resolveDbUrl: () => string;

  beforeAll(async () => {
    const mod = await import('~/lib/.server/db/resolve-db-url');
    resolveDbUrl = mod.resolveDbUrl;
  });

  const originalEnv = process.env.DEVONZ_DB_PATH;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DEVONZ_DB_PATH;
    } else {
      process.env.DEVONZ_DB_PATH = originalEnv;
    }
  });

  it('defaults to ./data/devonz.db when DEVONZ_DB_PATH is not set', () => {
    delete process.env.DEVONZ_DB_PATH;
    expect(resolveDbUrl()).toBe('file:./data/devonz.db');
  });

  it('uses DEVONZ_DB_PATH when set', () => {
    process.env.DEVONZ_DB_PATH = '/tmp/custom.db';
    expect(resolveDbUrl()).toBe('file:/tmp/custom.db');
  });
});
