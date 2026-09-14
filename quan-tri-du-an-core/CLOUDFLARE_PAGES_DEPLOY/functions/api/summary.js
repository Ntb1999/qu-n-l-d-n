// Cloudflare Pages Function: /api/summary
// Generates live aggregated UAT summary across all platforms

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

const TOTAL_DATASET = {
  mobile: 382,
  web: 271,
  core: 2033,
  tprl: 545,
  ekyc: 582
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    let centralState = null;
    const kv = env && (env.SBSI_STATE_KV || env.UAT_KV || env.SBSI_KV || env.KV);
    if (kv) {
      centralState = await kv.get('sbsi_central_state', { type: 'json' });
    }

    if (!centralState) {
      centralState = {
        mobile: {},
        web: {},
        core: {},
        tprl: {},
        ekyc: {}
      };
    }

    let grandTotal = 0;
    let grandPass = 0;
    let grandFail = 0;
    let grandPending = 0;
    const summary = {};

    for (const p in TOTAL_DATASET) {
      const total = TOTAL_DATASET[p];
      grandTotal += total;

      const pState = centralState[p] || {};
      let pass = 0, fail = 0, pending = 0;

      for (const id in pState) {
        const item = pState[id];
        const st = (typeof item === 'object' ? item.status : item || '').toLowerCase();
        if (st === 'pass') pass++;
        else if (st === 'fail') fail++;
        else if (st === 'pending') pending++;
      }

      const tested = pass + fail + pending;
      const untested = total - tested;
      const pct = total > 0 ? Math.round((pass / total) * 100) : 0;

      summary[p] = {
        total,
        pass,
        fail,
        pending,
        untested,
        pct
      };

      grandPass += pass;
      grandFail += fail;
      grandPending += pending;
    }

    const grandTested = grandPass + grandFail + grandPending;
    const grandUntested = grandTotal - grandTested;
    const grandPct = grandTotal > 0 ? Math.round((grandPass / grandTotal) * 100) : 0;

    summary.overall = {
      total: grandTotal,
      pass: grandPass,
      fail: grandFail,
      pending: grandPending,
      untested: grandUntested,
      pct: grandPct
    };

    return new Response(JSON.stringify({
      success: true,
      summary: summary,
      timestamp: Date.now()
    }), { headers: CORS_HEADERS });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: CORS_HEADERS });
  }
}
