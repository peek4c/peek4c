/**
 * Peek4c - 4chan Browser App
 * Copyright (c) 2025 Peek4c Contributors
 * 
 * This software is provided under the GPLv3 License.
 * See LICENSE file for details.
 * 
 * DISCLAIMER: This is an educational project. Users are responsible
 * for their own use of this application and the content they access.
 */

import * as SQLite from 'expo-sqlite';
import { ThreadPost } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export const getDB = async () => {
    if (db) return db;
    db = await SQLite.openDatabaseAsync('app.db');
    return db;
};

export const initDB = async () => {
    const database = await getDB();

    // Config table
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

    // Requests cache table
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS requests (
      url TEXT PRIMARY KEY,
      data TEXT,
      timestamp INTEGER
    );
  `);

    // Drop old tables to ensure schema update - REMOVED for persistence
    // await database.execAsync('DROP TABLE IF EXISTS history');
    // await database.execAsync('DROP TABLE IF EXISTS stars');
    // await database.execAsync('DROP TABLE IF EXISTS following');
    // await database.execAsync('DROP TABLE IF EXISTS threads');

    // Threads table (The Core)
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS threads (
      no INTEGER,
      board TEXT,
      resto INTEGER,
      time INTEGER,
      is_op INTEGER,
      data TEXT,
      blocked INTEGER DEFAULT 0,
      PRIMARY KEY (no, board)
    );
    CREATE INDEX IF NOT EXISTS idx_threads_board_time ON threads (board, time DESC);
    CREATE INDEX IF NOT EXISTS idx_threads_resto ON threads (board, resto);
  `);

    // Migration for blocked column
    try {
        await database.execAsync('ALTER TABLE threads ADD COLUMN blocked INTEGER DEFAULT 0');
    } catch (e) {
        // Column likely already exists
    }

    // Migration for last_fetched column
    try {
        await database.execAsync('ALTER TABLE threads ADD COLUMN last_fetched INTEGER DEFAULT 0');
    } catch (e) {
        // Column likely already exists
    }

    // Boards table
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS boards (
      board TEXT PRIMARY KEY,
      title TEXT,
      ws_board INTEGER,
      data TEXT
    );
  `);

    // History table
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS history (
      no INTEGER,
      board TEXT,
      resto INTEGER,
      timestamp INTEGER,
      PRIMARY KEY (no, board)
    );
    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history (timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_history_resto ON history (board, resto);
  `);

    // Stars table
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS stars (
      no INTEGER,
      board TEXT,
      timestamp INTEGER,
      PRIMARY KEY (no, board)
    );
    CREATE INDEX IF NOT EXISTS idx_stars_timestamp ON stars (timestamp DESC);
  `);

    // Following table
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS following (
      no INTEGER,
      board TEXT,
      timestamp INTEGER,
      PRIMARY KEY (no, board)
    );
    CREATE INDEX IF NOT EXISTS idx_following_timestamp ON following (timestamp DESC);
  `);

    // Legal Consent table
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS legal_consent (
      consent_type TEXT,
      version TEXT,
      timestamp INTEGER,
      accepted INTEGER,
      PRIMARY KEY (consent_type, version)
    );
  `);

    // Blocked Keywords table
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS blocked_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_blocked_keywords_keyword ON blocked_keywords (keyword);
  `);

    // Initialize default blocked keywords
    await initDefaultBlockedKeywords();
};

// Config
export const getConfig = async (key: string): Promise<string | null> => {
    const database = await getDB();
    const result = await database.getFirstAsync<{ value: string }>('SELECT value FROM config WHERE key = ?', [key]);
    return result ? result.value : null;
};

export const setConfig = async (key: string, value: string) => {
    const database = await getDB();
    await database.runAsync('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
    return;
};

// Requests Cache
export const getCachedRequest = async (url: string): Promise<{ data: string; timestamp: number } | null> => {
    const database = await getDB();
    const result = await database.getFirstAsync<{ data: string; timestamp: number }>('SELECT data, timestamp FROM requests WHERE url = ?', [url]);
    return result;
};

export const saveCachedRequest = async (url: string, data: string) => {
    const database = await getDB();
    const timestamp = Date.now();
    await database.runAsync('INSERT OR REPLACE INTO requests (url, data, timestamp) VALUES (?, ?, ?)', [url, data, timestamp]);
};

export const clearCache = async () => {
    const database = await getDB();
    await database.runAsync('DELETE FROM requests');
};

// --- Boards Management ---

export const saveBoards = async (boards: any[]) => {
    const database = await getDB();
    if (boards.length === 0) return;

    try {
        for (const board of boards) {
            const data = JSON.stringify(board);
            await database.runAsync(
                'INSERT OR REPLACE INTO boards (board, title, ws_board, data) VALUES (?, ?, ?, ?)',
                [board.board, board.title, board.ws_board, data]
            );
        }
    } catch (e) {
        console.error('[db] Error saving boards:', e);
    }
};

export const getBoards = async (): Promise<any[]> => {
    const database = await getDB();
    const results = await database.getAllAsync<{ data: string }>('SELECT data FROM boards');
    return results.map(r => JSON.parse(r.data));
};

export const getBoardInfo = async (boardId: string): Promise<any | null> => {
    const database = await getDB();
    const result = await database.getFirstAsync<{ data: string }>(
        'SELECT data FROM boards WHERE board = ?',
        [boardId]
    );
    return result ? JSON.parse(result.data) : null;
};


// --- Threads Management ---

export const saveThreads = async (items: ThreadPost[]) => {
    const database = await getDB();
    if (items.length === 0) return;

    // Use sequential inserts to avoid transaction issues on Android
    try {
        for (const item of items) {
            // Filter out items without media (tim or ext missing)
            if (!item.tim || !item.ext) continue;

            const isOp = item.resto === 0 ? 1 : 0;

            // Sanitize inputs to avoid NPE on Android
            const no = item.no ?? null;
            const board = item.board ?? null;
            const resto = item.resto ?? 0;
            const time = item.time ?? 0;
            const data = JSON.stringify(item);

            if (no === null || board === null) {
                console.warn('[db] Skipping item with missing PK:', item);
                continue;
            }

            try {
                await database.runAsync(
                    `INSERT OR REPLACE INTO threads (no, board, resto, time, is_op, data, blocked) 
                    VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT blocked FROM threads WHERE no=? AND board=?), 0))`,
                    [no, board, resto, time, isOp, data, no, board]
                );
            } catch (innerError) {
                console.error('[db] Error saving individual item:', item, innerError);
            }
        }
    } catch (e) {
        console.error('[db] Error saving items:', e);
    }
};

export const getThreadOp = async (threadId: number, board: string): Promise<ThreadPost | null> => {
    const database = await getDB();
    const result = await database.getFirstAsync<{ data: string }>(
        'SELECT data FROM threads WHERE no = ? AND board = ?',
        [threadId, board]
    );
    return result ? JSON.parse(result.data) : null;
};

export const updateThreadLastFetched = async (threadId: number, board: string) => {
    const database = await getDB();
    const timestamp = Date.now();
    await database.runAsync(
        'UPDATE threads SET last_fetched = ? WHERE no = ? AND board = ? AND resto = 0',
        [timestamp, threadId, board]
    );
};

export const getFollowedUnreadThreads = async (
    excludeUnsafeBoards: boolean = false,
    limit: number = 20,
    excludeNos: number[] = []
): Promise<ThreadPost[]> => {
    const database = await getDB();

    let query = `
        SELECT t.data 
        FROM following f
        JOIN threads op ON op.board = f.board AND op.no = f.no AND COALESCE(op.blocked, 0) = 0
        JOIN threads t ON f.no = (CASE WHEN t.resto = 0 THEN t.no ELSE t.resto END) AND f.board = t.board
        LEFT JOIN history h ON t.no = h.no AND t.board = h.board
    `;

    const conditions: string[] = ['h.no IS NULL'];
    const params: any[] = [];

    // Add excludeNos filter
    if (excludeNos.length > 0) {
        const placeholders = excludeNos.map(() => '?').join(',');
        conditions.push(`t.no NOT IN (${placeholders})`);
        params.push(...excludeNos);
    }

    if (excludeUnsafeBoards) {
        query += `LEFT JOIN boards b ON t.board = b.board
        WHERE ${conditions.join(' AND ')} AND (b.ws_board IS NULL OR b.ws_board = 1)`;
    } else {
        query += `WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY t.time DESC LIMIT ?`;
    params.push(limit);

    const results = await database.getAllAsync<{ data: string }>(query, params);
    const items = results.map(r => JSON.parse(r.data));

    // Hydrate OP context if needed
    for (const item of items) {
        if (item.resto !== 0) {
            const op = await getThreadOp(item.resto, item.board);
            if (op) item.opThread = op;
        }
    }

    // Filter by blocked keywords (considering new keywords added after data was saved)
    const filteredItems = await filterPostsByKeywords(items);
    return filteredItems;
};

export const getFollowedThreadsNeedingUpdate = async (): Promise<ThreadPost[]> => {
    const database = await getDB();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    const results = await database.getAllAsync<{ data: string; last_fetched: number }>(`
        SELECT t.data, t.last_fetched
        FROM following f
        JOIN threads t ON f.no = t.no AND f.board = t.board
        WHERE COALESCE(t.last_fetched, 0) < ?
        ORDER BY f.timestamp DESC
    `, [oneHourAgo]);

    return results.map(r => {
        const post = JSON.parse(r.data);
        post.last_fetched = r.last_fetched || 0;
        return post;
    });
};

export const getThreadItems = async (threadId: number, board: string): Promise<ThreadPost[]> => {
    const database = await getDB();
    // Get OP and all replies (where resto = threadId)
    // Note: OP has resto = 0, so we query (no = threadId) OR (resto = threadId)
    const results = await database.getAllAsync<{ data: string }>(
        'SELECT data FROM threads WHERE (no = ? OR resto = ?) AND board = ? ORDER BY time ASC',
        [threadId, threadId, board]
    );
    return results.map(r => JSON.parse(r.data));
};

export const getThreadItemsWithHistory = async (threadId: number, board: string): Promise<{ posts: ThreadPost[], viewed: Set<number> }> => {
    const database = await getDB();
    const results = await database.getAllAsync<{ data: string, is_viewed: number }>(
        `SELECT t.data, CASE WHEN h.no IS NOT NULL THEN 1 ELSE 0 END as is_viewed
         FROM threads t
         LEFT JOIN history h ON t.no = h.no AND t.board = h.board
         WHERE (t.no = ? OR t.resto = ?) AND t.board = ?
         ORDER BY t.time ASC`,
        [threadId, threadId, board]
    );

    const posts: ThreadPost[] = [];
    const viewed = new Set<number>();

    results.forEach(r => {
        const post = JSON.parse(r.data);
        posts.push(post);
        if (r.is_viewed) {
            viewed.add(post.no);
        }
    });

    return { posts, viewed };
};

export const getRecommendedItems = async (board: string, limit: number, excludeIds: number[] = []): Promise<ThreadPost[]> => {
    console.log(`[db] getRecommendedItems board=${board} limit=${limit} excludeIdsCount=${excludeIds.length}`);
    const database = await getDB();

    // 1. Get Followed & Unviewed items (excluding blocked and excluded)
    // We fetch more than needed to ensure we have enough after filtering
    const targetFollowedCount = Math.floor(limit * 0.4);
    const followedLimit = Math.max(targetFollowedCount * 2, 20); // Fetch enough candidates
    const otherLimit = limit * 2; // Fetch plenty of others

    const excludeIdsStr = excludeIds.length > 0 ? excludeIds.join(',') : '0';

    // Query for Followed Items
    // Matches if the thread (OP) is followed.
    const followedResults = await database.getAllAsync<{ data: string }>(
        `SELECT t.data 
         FROM following f
         JOIN threads op ON op.board = f.board and op.no = f.no AND COALESCE(op.blocked, 0) = 0
         JOIN threads t ON f.no = (CASE WHEN t.resto = 0 THEN t.no ELSE t.resto END) AND f.board = t.board
         LEFT JOIN history h ON t.no = h.no AND t.board = h.board
         WHERE t.board = ? 
           AND h.no IS NULL 
           AND t.no NOT IN (${excludeIdsStr})
         ORDER BY t.time DESC
         LIMIT ?`,
        [board, followedLimit]
    );

    // Query for Other Items
    // MUST exclude items that would be caught by the followed query to prevent duplicates.
    // Logic: Exclude if the thread (OP) is in the following table.
    const otherResults = await database.getAllAsync<{ data: string }>(
        `SELECT t.data 
         FROM threads t
         JOIN threads op ON op.board = t.board and op.no = (CASE WHEN t.resto = 0 THEN t.no ELSE t.resto END) AND COALESCE(op.blocked, 0) = 0
         LEFT JOIN history h ON t.no = h.no AND t.board = h.board
         LEFT JOIN following f ON f.board = t.board AND f.no = (CASE WHEN t.resto = 0 THEN t.no ELSE t.resto END)
         WHERE t.board = ? 
           AND h.no IS NULL 
           AND f.no IS NULL -- Crucial: Exclude if OP is followed
           AND t.no NOT IN (${excludeIdsStr})
         ORDER BY t.time DESC
         LIMIT ?`,
        [board, otherLimit]
    );

    let followedItems: ThreadPost[] = followedResults.map(r => JSON.parse(r.data));
    let otherItems: ThreadPost[] = otherResults.map(r => JSON.parse(r.data));

    console.log(`[db] Fetched candidates: Followed=${followedItems.length}, Other=${otherItems.length}`);

    // Randomize candidates
    const shuffleArray = (array: any[]) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    };
    shuffleArray(followedItems);
    shuffleArray(otherItems);

    // Hydrate OP context if needed
    const hydrate = async (items: ThreadPost[]) => {
        const opIdsToFetch = new Set<number>();
        for (const item of items) {
            if (item.resto !== 0 && !item.opThread) {
                opIdsToFetch.add(item.resto);
            }
        }

        if (opIdsToFetch.size === 0) return;

        const idsArray = Array.from(opIdsToFetch);
        const placeholders = idsArray.map(() => '?').join(',');

        const opResults = await database.getAllAsync<{ data: string }>(
            `SELECT data FROM threads WHERE board = ? AND no IN (${placeholders})`,
            [board, ...idsArray]
        );

        const opMap = new Map<number, ThreadPost>();
        opResults.forEach(r => {
            const op = JSON.parse(r.data);
            opMap.set(op.no, op);
        });

        for (const item of items) {
            if (item.resto !== 0 && !item.opThread) {
                const op = opMap.get(item.resto);
                if (op) item.opThread = op;
            }
        }
    };
    await hydrate(followedItems);
    await hydrate(otherItems);

    // Mixing Logic
    const result: ThreadPost[] = [];
    const addedIds = new Set<number>(); // Strict deduplication

    let followedIndex = 0;
    let otherIndex = 0;
    let lastOpId: number | null = null;
    const opCounts: { [key: number]: number } = {};

    // Helper to check if item can be added
    const canAdd = (item: ThreadPost, source: string) => {
        if (addedIds.has(item.no)) return false;

        const opId = item.resto === 0 ? item.no : item.resto;

        // Check consecutive
        if (lastOpId === opId) {
            // console.log(`[db] Skip ${item.no} (${source}): Consecutive OP ${opId}`);
            return false;
        }

        // Check 1/5 limit (max 20% from same thread in current batch)
        // Relaxed for small batches or if we are desperate, but let's keep it for quality
        const currentCount = opCounts[opId] || 0;
        if (result.length >= 5 && currentCount >= result.length / 5) {
            // console.log(`[db] Skip ${item.no} (${source}): 1/5 Limit reached for OP ${opId}`);
            return false;
        }

        return true;
    };

    while (result.length < limit) {
        let added = false;

        // Try to add from followed
        if (followedIndex < followedItems.length && (result.filter(i => followedItems.includes(i)).length < targetFollowedCount || otherIndex >= otherItems.length)) {
            const item = followedItems[followedIndex];
            if (canAdd(item, 'followed')) {
                result.push(item);
                addedIds.add(item.no);
                const opId = item.resto === 0 ? item.no : item.resto;
                lastOpId = opId;
                opCounts[opId] = (opCounts[opId] || 0) + 1;
                added = true;
            }
            followedIndex++;
        }

        // Try to add from others if not added yet (or if we need to fill up)
        if (!added && otherIndex < otherItems.length) {
            const item = otherItems[otherIndex];
            if (canAdd(item, 'other')) {
                result.push(item);
                addedIds.add(item.no);
                const opId = item.resto === 0 ? item.no : item.resto;
                lastOpId = opId;
                opCounts[opId] = (opCounts[opId] || 0) + 1;
                added = true;
            }
            otherIndex++;
        }

        // If we couldn't add anything but still have items, skip constraints to fill up?
        if (!added) {
            // Fallback: just add whatever is available if we are stuck
            if (followedIndex < followedItems.length) {
                const item = followedItems[followedIndex++];
                if (!addedIds.has(item.no)) {
                    // console.log(`[db] Fallback add ${item.no} from Followed`);
                    result.push(item);
                    addedIds.add(item.no);
                    added = true;
                }
            } else if (otherIndex < otherItems.length) {
                const item = otherItems[otherIndex++];
                if (!addedIds.has(item.no)) {
                    // console.log(`[db] Fallback add ${item.no} from Other`);
                    result.push(item);
                    addedIds.add(item.no);
                    added = true;
                }
            } else {
                // console.log(`[db] No more items available to fill limit`);
                break; // No more items
            }
        }
    }

    // Final shuffle of the result to mix followed and others even better?
    // Actually, the interleaving above is good, but a final shuffle ensures
    // that followed items aren't always at fixed positions (0, 2, 4...).
    shuffleArray(result);

    // Filter by blocked keywords (considering new keywords added after data was saved)
    const filteredResult = await filterPostsByKeywords(result);

    console.log(`[db] getRecommendedItems result count=${filteredResult.length}`);
    return filteredResult;
};
export const toggleBlock = async (item: ThreadPost) => {
    const database = await getDB();
    // We block the OP (Thread). If item is a reply, block its OP.
    const threadNo = item.resto === 0 ? item.no : item.resto;
    const board = item.board;

    // Check current status
    const result = await database.getFirstAsync<{ blocked: number }>(
        'SELECT blocked FROM threads WHERE no = ? AND board = ?',
        [threadNo, board]
    );

    const currentBlocked = result?.blocked === 1;
    const newBlocked = !currentBlocked;

    await database.runAsync(
        'UPDATE threads SET blocked = ? WHERE no = ? AND board = ?',
        [newBlocked ? 1 : 0, threadNo, board]
    );

    // If blocking, remove from following
    if (newBlocked) {
        await database.runAsync('DELETE FROM following WHERE no = ? AND board = ?', [threadNo, board]);
    }

    return newBlocked;
};

export const isBlocked = async (threadId: number, board: string): Promise<boolean> => {
    const database = await getDB();
    const result = await database.getFirstAsync<{ blocked: number }>(
        'SELECT blocked FROM threads WHERE no = ? AND board = ?',
        [threadId, board]
    );
    return result?.blocked === 1;
};

export const getBlockedItems = async (): Promise<ThreadPost[]> => {
    const database = await getDB();
    const results = await database.getAllAsync<{ data: string }>(
        `SELECT data FROM threads WHERE blocked = 1 ORDER BY time DESC`
    );
    return results.map(r => JSON.parse(r.data));
};

export const isThreadFullyLoaded = async (threadId: number, board: string): Promise<boolean> => {
    const database = await getDB();
    // Heuristic: If we have any reply with resto = threadId, we assume we might have loaded it?
    // Better: Check if we have a significant number of replies or a flag.
    // Since we don't have a "fully loaded" flag, we can check if there are ANY replies.
    // But for now, let's assume if we have > 1 item (OP + at least one reply) it's "loaded" 
    // OR if we just rely on the caller to decide when to fetch.
    // Actually, the caller (FeedView) will fetch if it's an OP.
    // Let's just check if we have the OP.

    // Refined logic: This function might be used to skip re-fetching.
    // If we have > 5 replies, maybe it's loaded? 
    // 4chan threads usually have replies.

    const count = await database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM threads WHERE (no = ? OR resto = ?) AND board = ?',
        [threadId, threadId, board]
    );

    return (count?.count || 0) > 1; // OP + at least 1 reply
};


// --- History Management ---

export const addToHistory = async (item: ThreadPost) => {
    const database = await getDB();
    const timestamp = Date.now();

    // Ensure item exists in threads table first
    await saveThreads([item]);

    const resto = item.resto || 0;

    await database.runAsync(
        'INSERT OR REPLACE INTO history (no, board, resto, timestamp) VALUES (?, ?, ?, ?)',
        [item.no, item.board, resto, timestamp]
    );
};

export const getViewedPosts = async (board: string, threadId: number): Promise<Set<number>> => {
    const database = await getDB();
    // Get all history items that are either the OP itself (no = threadId) or replies to it (resto = threadId)
    const results = await database.getAllAsync<{ no: number }>(
        'SELECT no FROM history WHERE board = ? AND (no = ? OR resto = ?)',
        [board, threadId, threadId]
    );
    return new Set(results.map(r => r.no));
};

export const getHistory = async (
    limit: number = 50,
    offset: number = 0,
    opOnly?: boolean,
    board?: string
): Promise<ThreadPost[]> => {
    console.log('getHistory', limit, offset, opOnly, board);
    const database = await getDB();

    let query = `SELECT t.data 
         FROM history h
         JOIN threads t ON h.no = t.no AND h.board = t.board`;

    const params: any[] = [];
    const conditions: string[] = [];

    // Add opOnly filter
    if (opOnly) {
        conditions.push('t.resto = 0');
    }

    // Add board filter
    if (board) {
        conditions.push('t.board = ?');
        params.push(board);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY h.timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const results = await database.getAllAsync<{ data: string }>(query, params);

    const items = results.map(r => JSON.parse(r.data));

    // Hydrate
    for (const item of items) {
        if (item.resto !== 0) {
            const op = await getThreadOp(item.resto, item.board);
            if (op) item.opThread = op;
        }
    }

    return items;
};

export const getHistoryBoards = async (limit: number = 3): Promise<string[]> => {
    const database = await getDB();
    const results = await database.getAllAsync<{ board: string; count: number }>(
        `SELECT t.board, COUNT(*) as count
         FROM history h
         JOIN threads t ON h.no = t.no AND h.board = t.board
         WHERE t.resto = 0
         GROUP BY t.board
         ORDER BY count DESC
         LIMIT ?`,
        [limit]
    );
    return results.map(r => r.board);
};

export const getHistoryNos = async (board: string, nos: number[]): Promise<number[]> => {
    const database = await getDB();
    if (nos.length === 0) return [];

    // Build placeholders for IN clause
    const placeholders = nos.map(() => '?').join(',');
    const results = await database.getAllAsync<{ no: number }>(
        `SELECT no FROM history WHERE board = ? AND no IN (${placeholders})`,
        [board, ...nos]
    );
    return results.map(r => r.no);
};

export const clearHistory = async () => {
    const database = await getDB();
    await database.runAsync('DELETE FROM history');
};

// --- Stars Management ---

export const toggleStar = async (item: ThreadPost) => {
    const database = await getDB();
    const exists = await database.getFirstAsync('SELECT 1 FROM stars WHERE no = ? AND board = ?', [item.no, item.board]);

    if (exists) {
        await database.runAsync('DELETE FROM stars WHERE no = ? AND board = ?', [item.no, item.board]);
        return false; // Unstarred
    } else {
        const timestamp = Date.now();
        // Ensure in threads
        await saveThreads([item]);

        await database.runAsync(
            'INSERT INTO stars (no, board, timestamp) VALUES (?, ?, ?)',
            [item.no, item.board, timestamp]
        );
        return true; // Starred
    }
};

export const getStars = async (): Promise<ThreadPost[]> => {
    const database = await getDB();
    const results = await database.getAllAsync<{ data: string }>(
        `SELECT t.data 
         FROM stars s
         JOIN threads t ON s.no = t.no AND s.board = t.board
         ORDER BY s.timestamp DESC`
    );
    const items = results.map(r => JSON.parse(r.data));

    // Hydrate
    for (const item of items) {
        if (item.resto !== 0) {
            const op = await getThreadOp(item.resto, item.board);
            if (op) item.opThread = op;
        }
    }
    return items;
};

export const isStarred = async (threadId: number, board: string): Promise<boolean> => {
    const database = await getDB();
    const result = await database.getFirstAsync('SELECT 1 FROM stars WHERE no = ? AND board = ?', [threadId, board]);
    return !!result;
};

// --- Following Management ---

export const toggleFollow = async (item: ThreadPost) => {
    const database = await getDB();

    // Check if blocked first
    const blocked = await isBlocked(item.no, item.board);
    if (blocked) {
        console.log('[db] Cannot follow blocked thread:', item.no);
        return false;
    }

    const exists = await database.getFirstAsync('SELECT 1 FROM following WHERE no = ? AND board = ?', [item.no, item.board]);

    if (exists) {
        await database.runAsync('DELETE FROM following WHERE no = ? AND board = ?', [item.no, item.board]);
        return false;
    } else {
        const timestamp = Date.now();
        await saveThreads([item]);
        await database.runAsync(
            'INSERT INTO following (no, board, timestamp) VALUES (?, ?, ?)',
            [item.no, item.board, timestamp]
        );
        return true;
    }
};

export const getFollowing = async (): Promise<ThreadPost[]> => {
    const database = await getDB();
    const results = await database.getAllAsync<{ data: string; last_fetched: number }>(`
        SELECT t.data, t.last_fetched
        FROM following f
        JOIN threads t ON f.no = t.no AND f.board = t.board
        ORDER BY f.timestamp DESC
    `);
    return results.map(r => {
        const post = JSON.parse(r.data);
        post.last_fetched = r.last_fetched || 0;
        return post;
    });
};

export const isFollowing = async (threadId: number, board: string): Promise<boolean> => {
    const database = await getDB();
    const result = await database.getFirstAsync('SELECT 1 FROM following WHERE no = ? AND board = ?', [threadId, board]);
    return !!result;
};

// --- Reset ---

export const resetAllData = async () => {
    const database = await getDB();
    await database.runAsync('DELETE FROM config');
    await database.runAsync('DELETE FROM requests');
    await database.runAsync('DELETE FROM history');
    await database.runAsync('DELETE FROM stars');
    await database.runAsync('DELETE FROM following');
    await database.runAsync('DELETE FROM threads');
    await database.runAsync('DELETE FROM boards');
    await database.runAsync('DELETE FROM legal_consent');
};

// --- Legal Consent ---

export const hasAcceptedTerms = async (): Promise<boolean> => {
    const database = await getDB();
    const result = await database.getFirstAsync<{ accepted: number }>(
        'SELECT accepted FROM legal_consent WHERE consent_type = ?',
        ['terms_of_service']
    );
    return result ? result.accepted === 1 : false;
};

export const acceptTerms = async (version: string = '1.0.0') => {
    const database = await getDB();
    const timestamp = Date.now();
    await database.runAsync(
        'INSERT OR REPLACE INTO legal_consent (consent_type, version, timestamp, accepted) VALUES (?, ?, ?, ?)',
        ['terms_of_service', version, timestamp, 1]
    );
};

// --- Blocked Keywords Management ---

const DEFAULT_BLOCKED_KEYWORDS = [
    // Violence & Fighting
    'violence',
    'fight',
    'beat',
    'beating',
    'assault',
    'attack',
    'brawl',
    'war',

    // Regions (often associated with disturbing content)
    'india',
    'africa',
    'brazil',
    'mexico',

    // Accidents & Disasters
    'disaster',
    'train',
    'accident',
    'crash',
    'explosion',

    // Death & Killing
    'death',
    'dead',
    'die',
    'died',
    'dying',
    'kill',
    'killed',
    'killing',
    'murder',
    'suicide',
    'electrocution',

    // Gore & Blood
    'gore',
    'blood',
    'bloody',
    'bleeding',
    'graphic',
    'nsfl',
    'brutal',

    // Weapons & Violence Methods
    'shooting',
    'shot',
    'gun',
    'stabbing',
    'stab',
    'knife',
    'beheading',
    'decapitation',

    // Extreme Violence
    'execution',
    'torture',
    'mutilation',
    'dismember',
    'severed',
    'amputation',

    // Bodies & Remains
    'corpse',
    'body',
    'dead body',
    'remains',

    // Criminal & Cartel
    'cartel',
    'gang',
    'mafia',

    // Injuries & Medical Gore
    'injury',
    'wound',
    'trauma',
    'burn',
    'burned',

    // Disgusting & Filth
    'filth',
    'vomit',
    'puke',
    'puking',
    'vomiting',
    'feces',
    'shit',
    'poop',
    'scat',
    'defecate',
    'urine',
    'piss',
    'pee',
    'diarrhea',
    'sewage',
    'toilet',
    'gross',
    'disgusting',
    'rotten',
    'decay',
    'maggot',
    'worm',
    'parasite',

    // Other Disturbing
    'hanging',
    'lynching',
    'drowning',
    'suffocation',
    'rape',
    'abuse',
    'victim'
];

export const initDefaultBlockedKeywords = async (force: boolean = false) => {
    const database = await getDB();

    // Check if we've already initialized keywords before
    if (!force) {
        const initialized = await getConfig('blocked_keywords_initialized');
        if (initialized === 'true') {
            console.log('[db] Blocked keywords already initialized, skipping');
            return;
        }
    }

    const timestamp = Date.now();

    // Add default keywords
    for (const keyword of DEFAULT_BLOCKED_KEYWORDS) {
        try {
            await database.runAsync(
                'INSERT OR IGNORE INTO blocked_keywords (keyword, created_at) VALUES (?, ?)',
                [keyword.toLowerCase(), timestamp]
            );
        } catch (e) {
            console.error('[db] Error adding default keyword:', keyword, e);
        }
    }

    // Mark as initialized
    await setConfig('blocked_keywords_initialized', 'true');
    console.log('[db] Initialized default blocked keywords');
};

export const addBlockedKeyword = async (keyword: string) => {
    const database = await getDB();
    const timestamp = Date.now();
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
        throw new Error('Keyword cannot be empty');
    }

    await database.runAsync(
        'INSERT OR IGNORE INTO blocked_keywords (keyword, created_at) VALUES (?, ?)',
        [normalizedKeyword, timestamp]
    );
};

export const removeBlockedKeyword = async (keyword: string) => {
    const database = await getDB();
    const normalizedKeyword = keyword.trim().toLowerCase();

    await database.runAsync(
        'DELETE FROM blocked_keywords WHERE keyword = ?',
        [normalizedKeyword]
    );
};

export const clearAllBlockedKeywords = async () => {
    const database = await getDB();
    await database.runAsync('DELETE FROM blocked_keywords');
};

export const resetToDefaultBlockedKeywords = async () => {
    await clearAllBlockedKeywords();
    // Force re-initialization of default keywords
    await initDefaultBlockedKeywords(true);
};

export const getBlockedKeywords = async (): Promise<string[]> => {
    const database = await getDB();
    const results = await database.getAllAsync<{ keyword: string }>(
        'SELECT keyword FROM blocked_keywords ORDER BY created_at ASC'
    );
    return results.map(r => r.keyword);
};

export const containsBlockedKeyword = async (text: string): Promise<boolean> => {
    if (!text) return false;

    const keywords = await getBlockedKeywords();
    const normalizedText = text.toLowerCase();

    return keywords.some(keyword => normalizedText.includes(keyword));
};

// Helper function to filter posts by blocked keywords
export const filterPostsByKeywords = async (posts: ThreadPost[]): Promise<ThreadPost[]> => {
    const keywords = await getBlockedKeywords();
    if (keywords.length === 0) return posts;

    const filtered: ThreadPost[] = [];

    for (const post of posts) {
        const textToCheck = `${post.sub || ''} ${post.com || ''} ${post.filename || ''}`.toLowerCase();
        const hasBlockedKeyword = keywords.some(keyword => textToCheck.includes(keyword));

        if (!hasBlockedKeyword) {
            filtered.push(post);
        }
    }

    return filtered;
};
