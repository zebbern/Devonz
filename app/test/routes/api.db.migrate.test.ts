/// <reference types="vitest/globals" />
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import * as schema from '~/lib/.server/db/schema';

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

  await testDb.run(sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      full_message TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await testDb.run(sql`CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)`);
  await testDb.run(sql`CREATE INDEX IF NOT EXISTS idx_messages_sort_order ON messages(chat_id, sort_order)`);

  await testDb.run(sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      chat_id TEXT PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// -- Mocks ------------------------------------------------------------------

let testDb: ReturnType<typeof createTestDb>;

vi.mock('~/lib/.server/db', () => ({
  get db() {
    return testDb;
  },
  get schema() {
    return schema;
  },
}));

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

// Import the route handler AFTER mocks
const { action } = await import('~/routes/api.db.migrate');

// -- Helpers ----------------------------------------------------------------

function buildActionArgs(body: unknown) {
  const request = new Request('http://localhost/api/db/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { request, params: {}, context: {} as any, unstable_url: new URL(request.url), unstable_pattern: '' };
}

function buildInvalidJsonArgs() {
  const request = new Request('http://localhost/api/db/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not valid json!!!',
  });

  return { request, params: {}, context: {} as any, unstable_url: new URL(request.url), unstable_pattern: '' };
}

// -- Tests ------------------------------------------------------------------

describe('POST /api/db/migrate', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await migrateTestDb(testDb);
  });

  it('successfully migrates a batch of chats with messages and snapshots', async () => {
    const payload = {
      chats: [
        {
          id: 'chat-1',
          urlId: 'chat-1-url',
          description: 'First chat',
          timestamp: '2025-01-01T00:00:00.000Z',
          messages: [
            { id: 'msg-1', role: 'user', content: 'Hello' },
            { id: 'msg-2', role: 'assistant', content: 'Hi there!' },
          ],
          metadata: { gitUrl: 'https://github.com/test/repo' },
        },
        {
          id: 'chat-2',
          urlId: 'chat-2-url',
          description: 'Second chat',
          timestamp: '2025-01-02T00:00:00.000Z',
          messages: [{ id: 'msg-3', role: 'user', content: 'Question' }],
        },
      ],
      snapshots: [
        {
          chatId: 'chat-1',
          snapshot: { chatIndex: '0', files: { 'index.ts': { type: 'file', content: 'hello' } } },
        },
      ],
    };

    const response = await action(buildActionArgs(payload));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.migrated.chats).toBe(2);
    expect(data.migrated.messages).toBe(3);
    expect(data.migrated.snapshots).toBe(1);
    expect(data.skipped).toEqual([]);
    expect(data.total).toBe(2);

    // Verify data actually exists in the DB
    const chatRows = await testDb.select().from(schema.chats);
    expect(chatRows).toHaveLength(2);
    expect(chatRows.find((c) => c.id === 'chat-1')?.description).toBe('First chat');

    const msgRows = await testDb.select().from(schema.messages);
    expect(msgRows).toHaveLength(3);

    const snapRows = await testDb.select().from(schema.snapshots);
    expect(snapRows).toHaveLength(1);
  });

  it('handles empty IndexedDB export gracefully', async () => {
    const response = await action(buildActionArgs({ chats: [], snapshots: [] }));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.migrated.chats).toBe(0);
    expect(data.migrated.messages).toBe(0);
    expect(data.migrated.snapshots).toBe(0);
    expect(data.total).toBe(0);
  });

  it('rejects malformed records while accepting valid ones', async () => {
    const payload = {
      chats: [
        {
          id: 'valid-chat',
          description: 'Good chat',
          messages: [
            { id: 'msg-good', role: 'user', content: 'Valid message' },
            { id: 123, role: 'invalid_role', content: 456 }, // malformed message
          ],
        },
      ],
    };

    const response = await action(buildActionArgs(payload));
    expect(response.status).toBe(200);

    const data = await response.json();

    // The valid chat should still be migrated
    expect(data.migrated.chats).toBe(1);

    // Only the valid message should be counted
    expect(data.migrated.messages).toBe(1);

    // Verify DB has only the valid message
    const msgRows = await testDb.select().from(schema.messages);
    expect(msgRows).toHaveLength(1);
    expect(msgRows[0].id).toBe('msg-good');
  });

  it('returns 400 for completely invalid payload', async () => {
    const response = await action(buildActionArgs({ notAValidPayload: true }));
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid migration payload');
  });

  it('returns 400 for invalid JSON body', async () => {
    const response = await action(buildInvalidJsonArgs());
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid JSON in request body');
  });

  it('tracks migration progress across batches', async () => {
    // Create 60 chats to force multiple batches (batch size = 50)
    const chats = Array.from({ length: 60 }, (_, i) => ({
      id: `batch-chat-${i}`,
      description: `Chat ${i}`,
      messages: [{ id: `batch-msg-${i}`, role: 'user' as const, content: `Message ${i}` }],
    }));

    const response = await action(buildActionArgs({ chats }));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.migrated.chats).toBe(60);
    expect(data.migrated.messages).toBe(60);
    expect(data.total).toBe(60);

    // Verify all 60 chats in DB
    const chatRows = await testDb.select().from(schema.chats);
    expect(chatRows).toHaveLength(60);
  });

  it('handles duplicate migration gracefully (idempotent)', async () => {
    const payload = {
      chats: [
        {
          id: 'dup-chat',
          description: 'Original',
          messages: [{ id: 'dup-msg', role: 'user', content: 'Hello' }],
        },
      ],
    };

    // First migration
    const res1 = await action(buildActionArgs(payload));
    expect(res1.status).toBe(200);

    // Second migration of same data — should not throw
    const res2 = await action(buildActionArgs(payload));
    expect(res2.status).toBe(200);

    const data = await res2.json();
    expect(data.migrated.chats).toBe(1);

    // DB should still have just one chat (not duplicated)
    const chatRows = await testDb.select().from(schema.chats);
    expect(chatRows).toHaveLength(1);
  });
});
