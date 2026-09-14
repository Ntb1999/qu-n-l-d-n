// Cloudflare Pages Function: /api/state
// Supports multi-device, cross-browser synchronization for SBSI UAT Platform

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

const INITIAL_PLATFORMS = {
  mobile: {},
  web: {},
  core: {},
  tprl: {},
  ekyc: {}
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform');

  try {
    let centralState = null;
    const kv = env && (env.SBSI_STATE_KV || env.UAT_KV || env.SBSI_KV || env.KV);
    if (kv) {
      centralState = await kv.get('sbsi_central_state', { type: 'json' });
    }

    if (!centralState) {
      centralState = { ...INITIAL_PLATFORMS };
    }

    if (platform) {
      const pState = centralState[platform] || {};
      return new Response(JSON.stringify({
        success: true,
        platform: platform,
        state: pState,
        timestamp: Date.now()
      }), { headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({
      success: true,
      state: centralState,
      timestamp: Date.now()
    }), { headers: CORS_HEADERS });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      state: INITIAL_PLATFORMS
    }), { status: 200, headers: CORS_HEADERS });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform');

  try {
    const payload = await request.json();
    let centralState = null;

    const kv = env && (env.SBSI_STATE_KV || env.UAT_KV || env.SBSI_KV || env.KV);
    if (kv) {
      centralState = await kv.get('sbsi_central_state', { type: 'json' });
    }

    if (!centralState) {
      centralState = { ...INITIAL_PLATFORMS };
    }

    if (platform && payload && typeof payload === 'object') {
      if (!centralState[platform]) {
        centralState[platform] = {};
      }
      
      // Merge platform state
      centralState[platform] = {
        ...centralState[platform],
        ...payload
      };

      const kv = env && (env.SBSI_STATE_KV || env.UAT_KV || env.SBSI_KV || env.KV);
    if (kv) {
        await kv.put('sbsi_central_state', JSON.stringify(centralState));

        // Auto append to audit log if single test case update detected
        const keys = Object.keys(payload);
        if (keys.length === 1) {
          const tcId = keys[0];
          const item = payload[tcId];
          const status = typeof item === 'object' ? item.status : item;
          const tester = typeof item === 'object' ? item.tester : 'Tester';
          const time = typeof item === 'object' ? item.time : new Date().toLocaleTimeString('vi-VN');

          try {
            let logs = await kv.get('sbsi_audit_logs', { type: 'json' }) || [];
            logs.unshift({
              id: tcId,
              platform: platform,
              status: status,
              tester: tester,
              time: time,
              timestamp: Date.now()
            });
            if (logs.length > 50) logs = logs.slice(0, 50);
            await kv.put('sbsi_audit_logs', JSON.stringify(logs));
          } catch(e) {}
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Platform state updated successfully',
        platform: platform,
        updatedCount: Object.keys(payload).length,
        timestamp: Date.now()
      }), { headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid platform or payload'
    }), { status: 400, headers: CORS_HEADERS });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: CORS_HEADERS });
  }
}
