import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getUnixTimestamp } from '@tokyo86/shared';

// 6桁のランダム英数字を生成
function generateBatchId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

type Bindings = {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_IMAGES_API_TOKEN: string;
  STK_API_URL: string;
  STK_API_KEY: string;
  STK: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// ミドルウェア
app.use('*', logger());
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = (c.env.ALLOWED_ORIGINS || '*').split(',');
  
  const corsOrigin = (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) 
    ? origin 
    : allowedOrigins[0];

  return cors({
    origin: corsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

// --- Works API ---
const workSchema = z.object({
  type: z.enum(['comic', 'illustration']),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  author: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  thumbnail_image_id: z.string().nullable().optional(),
  og_image_id: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

app.get('/api/works', async (c) => {
  const type = c.req.query('type');
  let query = 'SELECT * FROM works';
  const params: any[] = [];
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  query += ' ORDER BY created_at DESC';
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ success: true, data: results });
});

app.get('/api/works/:id', async (c) => {
  const idOrSlug = c.req.param('id');
  let result = await c.env.DB.prepare('SELECT * FROM works WHERE id = ?').bind(idOrSlug).first();
  if (!result) {
    result = await c.env.DB.prepare('SELECT * FROM works WHERE slug = ?').bind(idOrSlug).first();
  }
  return c.json({ success: true, data: result });
});

app.post('/api/works', zValidator('json', workSchema), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  const now = getUnixTimestamp();
  
  await c.env.DB.prepare(
    'INSERT INTO works (id, type, title, slug, description, author, status, thumbnail_image_id, og_image_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    data.type,
    data.title,
    data.slug,
    data.description ?? null,
    data.author ?? 'Admin',
    data.status,
    data.thumbnail_image_id ?? null,
    data.og_image_id ?? null,
    JSON.stringify(data.tags || []),
    now,
    now
  ).run();
  
  const result = await c.env.DB.prepare('SELECT * FROM works WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: result });
});

app.put('/api/works/:id', zValidator('json', workSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const now = getUnixTimestamp();
  
  const fields = Object.keys(data);
  if (fields.length === 0) return c.json({ success: true });
  
  const sets = fields.map(f => `${f} = ?`).join(', ') + ', updated_at = ?';
  const values = fields.map(f => {
    const val = (data as any)[f];
    return Array.isArray(val) ? JSON.stringify(val) : val;
  });
  values.push(now, id);

  await c.env.DB.prepare(`UPDATE works SET ${sets} WHERE id = ?`).bind(...values).run();
  const result = await c.env.DB.prepare('SELECT * FROM works WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: result });
});

app.delete('/api/works/:id', async (c) => {
  const id = c.req.param('id');
  // エピソードも削除するかは要件次第だが、一旦作品のみ
  await c.env.DB.prepare('DELETE FROM works WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// --- Illustrations API ---
const illustrationSchema = z.object({
  work_id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  image_id: z.string(),
  og_image_id: z.string().nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  tags: z.array(z.string()),
});

app.get('/api/illustrations', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM illustrations ORDER BY created_at DESC').all();
  return c.json({ success: true, data: results });
});

app.get('/api/illustrations/:id', async (c) => {
  const idOrSlug = c.req.param('id');
  // まず ID で検索
  let result = await c.env.DB.prepare('SELECT * FROM illustrations WHERE id = ?').bind(idOrSlug).first();
  
  // 見つからない場合は slug で検索
  if (!result) {
    result = await c.env.DB.prepare('SELECT * FROM illustrations WHERE slug = ?').bind(idOrSlug).first();
  }
  
  return c.json({ success: true, data: result });
});

app.post('/api/illustrations', zValidator('json', illustrationSchema), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  const now = getUnixTimestamp();
  
  await c.env.DB.prepare(
    'INSERT INTO illustrations (id, work_id, title, slug, description, image_id, og_image_id, status, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, 
    data.work_id, 
    data.title, 
    data.slug, 
    data.description ?? null, 
    data.image_id, 
    data.og_image_id ?? null, 
    data.status, 
    JSON.stringify(data.tags), 
    now, 
    now
  ).run();
  
  const result = await c.env.DB.prepare('SELECT * FROM illustrations WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: result });
});

app.put('/api/illustrations/:id', zValidator('json', illustrationSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const now = getUnixTimestamp();
  
  // 動的なクエリ構築 (簡易版)
  const fields = Object.keys(data);
  if (fields.length === 0) return c.json({ success: true });
  
  const sets = fields.map(f => `${f} = ?`).join(', ') + ', updated_at = ?';
  const values = fields.map(f => {
    const val = (data as any)[f];
    return Array.isArray(val) ? JSON.stringify(val) : val;
  });
  values.push(now, id);

  await c.env.DB.prepare(`UPDATE illustrations SET ${sets} WHERE id = ?`).bind(...values).run();
  const result = await c.env.DB.prepare('SELECT * FROM illustrations WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: result });
});

app.delete('/api/illustrations/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM illustrations WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// --- Images API ---
app.get('/api/images', async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare(
    'SELECT * FROM images ORDER BY created_at DESC LIMIT 100'
  ).all();
  return c.json({ success: true, data: results });
});

// --- Episodes API ---
const episodeSchema = z.object({
  work_id: z.string(),
  episode_number: z.number(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  content: z.string(),
  status: z.enum(['draft', 'published', 'archived']),
  thumbnail_image_id: z.string().nullable().optional(),
  og_image_id: z.string().nullable().optional(),
});

app.get('/api/episodes', async (c) => {
  const workId = c.req.query('workId');
  let query = 'SELECT * FROM episodes';
  const params: any[] = [];
  if (workId) {
    query += ' WHERE work_id = ?';
    params.push(workId);
  }
  query += ' ORDER BY episode_number DESC';
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ success: true, data: results });
});

app.get('/api/episodes/:id', async (c) => {
  const idOrSlug = c.req.param('id');
  let result = await c.env.DB.prepare('SELECT * FROM episodes WHERE id = ?').bind(idOrSlug).first();
  if (!result) {
    result = await c.env.DB.prepare('SELECT * FROM episodes WHERE slug = ?').bind(idOrSlug).first();
  }
  return c.json({ success: true, data: result });
});

app.post('/api/episodes', zValidator('json', episodeSchema), async (c) => {
  const data = c.req.valid('json');
  const id = crypto.randomUUID();
  const now = getUnixTimestamp();
  
  await c.env.DB.prepare(
    'INSERT INTO episodes (id, work_id, episode_number, title, slug, description, content, status, thumbnail_image_id, og_image_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, 
    data.work_id, 
    data.episode_number, 
    data.title, 
    data.slug, 
    data.description ?? null, 
    data.content, 
    data.status, 
    data.thumbnail_image_id ?? null, 
    data.og_image_id ?? null, 
    now, 
    now
  ).run();
  
  const result = await c.env.DB.prepare('SELECT * FROM episodes WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: result });
});

app.put('/api/episodes/:id', zValidator('json', episodeSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const now = getUnixTimestamp();
  
  const fields = Object.keys(data);
  if (fields.length === 0) return c.json({ success: true });
  
  const sets = fields.map(f => `${f} = ?`).join(', ') + ', updated_at = ?';
  const values = fields.map(f => (data as any)[f]);
  values.push(now, id);

  await c.env.DB.prepare(`UPDATE episodes SET ${sets} WHERE id = ?`).bind(...values).run();
  const result = await c.env.DB.prepare('SELECT * FROM episodes WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: result });
});

app.delete('/api/episodes/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM episodes WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// --- Upload API ---
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;

    if (!file) {
      return c.json({ success: false, error: 'File is required' }, 400);
    }

    const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = c.env.CLOUDFLARE_IMAGES_API_TOKEN;

    if (!accountId) {
      return c.json({ success: false, error: 'CLOUDFLARE_ACCOUNT_ID is missing' }, 500);
    }
    if (!apiToken) {
      return c.json({ success: false, error: 'CLOUDFLARE_IMAGES_API_TOKEN is missing' }, 500);
    }

    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
        body: uploadFormData,
      }
    );

    const result: any = await response.json();

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Cloudflare API error',
        details: result.errors || result.messages || result
      }, 500);
    }

    const imageId = result.result.id;
    const filename = result.result.filename || file.name;

    // DB に画像を記録
    try {
      await c.env.DB.prepare(
        'INSERT INTO images (id, filename, created_at, updated_at) VALUES (?, ?, ?, ?)'
      ).bind(
        imageId,
        filename,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000)
      ).run();
    } catch (dbError) {
      console.error('Failed to record image in DB:', dbError);
    }

    return c.json({
      success: true,
      data: {
        id: imageId,
        filename: filename,
        variants: result.result.variants,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// --- Batch API ---
// バッチ作成
app.post('/api/batches', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const id = crypto.randomUUID();
  let batchId = generateBatchId();
  
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.prepare('SELECT id FROM image_batches WHERE batch_id = ?').bind(batchId).first();
    if (!existing) break;
    batchId = generateBatchId();
    attempts++;
  }
  
  const now = getUnixTimestamp();
  const purpose = body.purpose === 'toon' ? 'toon' : 'cdn';
  await db.prepare(
    'INSERT INTO image_batches (id, batch_id, name, description, episode_id, purpose, total_images, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, batchId, body.name || null, body.description || null, body.episode_id || null, purpose, 0, now, now).run();
  
  const result = await db.prepare('SELECT * FROM image_batches WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: result });
});

// バッチ一覧取得
app.get('/api/batches', async (c) => {
  const db = c.env.DB;
  const purpose = c.req.query('purpose');
  let query = 'SELECT * FROM image_batches';
  const params: string[] = [];
  if (purpose) {
    query += ' WHERE purpose = ?';
    params.push(purpose);
  }
  query += ' ORDER BY created_at DESC';
  const { results } = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: results });
});

// バッチ詳細取得
app.get('/api/batches/:batchId', async (c) => {
  const db = c.env.DB;
  const batchId = c.req.param('batchId');
  const batch = await db.prepare('SELECT * FROM image_batches WHERE batch_id = ?').bind(batchId).first();
  if (!batch) return c.json({ success: false, error: 'Batch not found' }, 404);

  const { results: images } = await db.prepare('SELECT * FROM images WHERE batch_id = ? ORDER BY sequence_number ASC').bind(batchId).all();
  return c.json({ success: true, data: { ...batch, images } });
});

// バッチ更新
app.put('/api/batches/:batchId', async (c) => {
  const db = c.env.DB;
  const batchId = c.req.param('batchId');
  const body = await c.req.json();

  const batch = await db.prepare('SELECT * FROM image_batches WHERE batch_id = ?').bind(batchId).first();
  if (!batch) return c.json({ success: false, error: 'Batch not found' }, 404);

  const now = getUnixTimestamp();
  const updates: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    values.push(body.name || null);
  }
  if (body.description !== undefined) {
    updates.push('description = ?');
    values.push(body.description || null);
  }
  if (body.purpose !== undefined) {
    const purpose = body.purpose === 'toon' ? 'toon' : 'cdn';
    updates.push('purpose = ?');
    values.push(purpose);
  }

  if (updates.length === 0) {
    return c.json({ success: true, data: batch });
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(batchId);

  await db.prepare(`UPDATE image_batches SET ${updates.join(', ')} WHERE batch_id = ?`).bind(...values).run();

  const result = await db.prepare('SELECT * FROM image_batches WHERE batch_id = ?').bind(batchId).first();
  return c.json({ success: true, data: result });
});

// バッチへの画像アップロード
app.post('/api/batches/:batchId/upload', async (c) => {
  const db = c.env.DB;
  const batchId = c.req.param('batchId');
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_IMAGES_API_TOKEN;
  
  const batch = await db.prepare('SELECT * FROM image_batches WHERE batch_id = ?').bind(batchId).first<any>();
  if (!batch) return c.json({ success: false, error: 'Batch not found' }, 404);
  
  const formData = await c.req.formData();
  const files = formData.getAll('files');
  if (files.length === 0) return c.json({ success: false, error: 'No files provided' }, 400);
  
  const uploadedImages = [];
  const errors: string[] = [];
  let currentSequence = batch.total_images + 1;

  for (const fileEntry of files) {
    if (typeof fileEntry === 'string') continue;
    const file = fileEntry as File;
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}` },
        body: uploadFormData,
      });
      const result: any = await response.json();
      if (!result.success) {
        const errMsg = JSON.stringify(result.errors || result.messages || result);
        console.error(`CF Images upload failed for ${file.name}:`, errMsg);
        errors.push(`${file.name}: ${errMsg}`);
        continue;
      }

      const imageId = result.result.id;
      const filename = result.result.filename || file.name;
      const now = getUnixTimestamp();
      await db.prepare('INSERT INTO images (id, filename, batch_id, sequence_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(imageId, filename, batchId, currentSequence, now, now).run();

      uploadedImages.push({ id: imageId, filename, sequence_number: currentSequence });
      currentSequence++;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('Upload error:', errMsg);
      errors.push(errMsg);
    }
  }

  if (uploadedImages.length === 0 && errors.length > 0) {
    return c.json({ success: false, error: 'All uploads failed', details: errors }, 500);
  }
  
  await db.prepare('UPDATE image_batches SET total_images = ?, updated_at = ? WHERE batch_id = ?')
    .bind(currentSequence - 1, getUnixTimestamp(), batchId).run();

  return c.json({ success: true, data: uploadedImages });
});

// バッチ完了通知 → stkに1記事として記録
app.post('/api/batches/:batchId/finalize', async (c) => {
  const db = c.env.DB;
  const batchId = c.req.param('batchId');

  const batch = await db.prepare('SELECT * FROM image_batches WHERE batch_id = ?').bind(batchId).first<any>();
  if (!batch) return c.json({ success: false, error: 'Batch not found' }, 404);

  if (!c.env.STK) return c.json({ success: false, error: 'STK binding not available' }, 500);

  try {
    const { results: images } = await db.prepare(
      'SELECT sequence_number FROM images WHERE batch_id = ? ORDER BY sequence_number ASC'
    ).bind(batchId).all<{ sequence_number: number }>();

    const baseUrl = 'https://img.tokyo86.com';
    const title = (batch.name as string | null) || `画像バッチ ${batchId}`;
    const urlLines = images.map(img =>
      `![](${baseUrl}/${batchId}/${String(img.sequence_number).padStart(3, '0')}.webp)`
    ).join('\n');
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const content = `${timestamp} アップロード\n\n${urlLines}`;

    const res = await c.env.STK.fetch('https://unified-mcp.belong2jazz.workers.dev/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${c.env.STK_API_KEY}`,
      },
      body: JSON.stringify({ title, content, tags: ['画像', 'CDN'] }),
    });
    const body = await res.json() as any;
    return c.json({ success: true, articleId: body.articleId });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Markdown 生成
app.get('/api/batches/:batchId/markdown', async (c) => {
  const db = c.env.DB;
  const batchId = c.req.param('batchId');
  const baseUrl = c.req.query('baseUrl') || `https://img.tokyo86.com`;
  
  const { results: images } = await db.prepare('SELECT sequence_number FROM images WHERE batch_id = ? ORDER BY sequence_number ASC').bind(batchId).all<{ sequence_number: number }>();
  if (!images || images.length === 0) return c.json({ success: false, error: 'No images found' }, 404);
  
  const markdown = images.map(img => `![](${baseUrl}/${batchId}/${String(img.sequence_number).padStart(3, '0')}.webp)`).join('\n');
  return c.json({ success: true, data: { markdown } });
});

// バッチ削除
app.delete('/api/batches/:batchId', async (c) => {
  const db = c.env.DB;
  const batchId = c.req.param('batchId');
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_IMAGES_API_TOKEN;
  
  const batch = await db.prepare('SELECT * FROM image_batches WHERE batch_id = ?').bind(batchId).first();
  if (!batch) return c.json({ success: false, error: 'Batch not found' }, 404);
  
  const { results: images } = await db.prepare('SELECT id FROM images WHERE batch_id = ?').bind(batchId).all<{ id: string }>();
  if (images && images.length > 0) {
    for (const img of images) {
      try {
        await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${img.id}`, {
          method: 'DELETE', headers: { 'Authorization': `Bearer ${apiToken}` }
        });
      } catch (e) { console.error(`Failed to delete image ${img.id}`); }
    }
  }
  
  await db.prepare('DELETE FROM images WHERE batch_id = ?').bind(batchId).run();
  await db.prepare('DELETE FROM image_batches WHERE batch_id = ?').bind(batchId).run();
  return c.json({ success: true });
});

// --- Image API ---
// 画像一覧取得
app.get('/api/images', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM images ORDER BY created_at DESC LIMIT 100').all();
  return c.json({ success: true, data: results });
});

// 個別画像削除
app.delete('/api/images/:id', async (c) => {
  const db = c.env.DB;
  const imageId = c.req.param('id');
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_IMAGES_API_TOKEN;

  if (!accountId || !apiToken) return c.json({ success: false, error: 'Cloudflare config missing' }, 500);

  try {
    await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${apiToken}` }
    });
  } catch (error) { console.error('CF deletion error:', error); }

  await db.prepare('DELETE FROM images WHERE id = ?').bind(imageId).run();
  return c.json({ success: true });
});

// 画像一括削除
app.post('/api/images/bulk-delete', async (c) => {
  const { ids } = await c.req.json();
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_IMAGES_API_TOKEN;

  if (!ids || !Array.isArray(ids)) return c.json({ success: false, error: 'Invalid IDs' }, 400);

  for (const id of ids) {
    try {
      await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${apiToken}` }
      });
      await c.env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
    } catch (e) { console.error(`Failed to delete ${id}`); }
  }
  return c.json({ success: true });
});

// --- Settings & Debug ---
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Route not found',
    method: c.req.method,
    path: c.req.path
  }, 404);
});

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
    message: err.message
  }, 500);
});

export default app;
