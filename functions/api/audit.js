// Cloudflare Pages Function: /api/audit
// Stores and streams live activity feed across all testers

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  try {
    let logs = [];
    const kv = env && (env.SBSI_STATE_KV || env.UAT_KV || env.SBSI_KV || env.KV);
    if (kv) {
      logs = await kv.get('sbsi_audit_logs', { type: 'json' }) || [];
    }

    return new Response(JSON.stringify({
      success: true,
      logs: logs.slice(0, limit),
      count: logs.length,
      timestamp: Date.now()
    }), { headers: CORS_HEADERS });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      logs: []
    }), { status: 200, headers: CORS_HEADERS });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const entry = await request.json();
    let logs = [];

    const kv = env && (env.SBSI_STATE_KV || env.UAT_KV || env.SBSI_KV || env.KV);
    if (kv) {
      logs = await kv.get('sbsi_audit_logs', { type: 'json' }) || [];
      
      logs.unshift({
        id: entry.id || '',
        platform: entry.platform || '',
        status: entry.status || '',
        tester: entry.tester || 'Tester',
        time: entry.time || new Date().toLocaleTimeString('vi-VN'),
        timestamp: Date.now()
      });

      if (logs.length > 50) logs = logs.slice(0, 50);
      await kv.put('sbsi_audit_logs', JSON.stringify(logs));
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Audit log appended',
      timestamp: Date.now()
    }), { headers: CORS_HEADERS });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: CORS_HEADERS });
  }
}
