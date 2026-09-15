// Cloudflare Pages Function: /api/jira-sync
// Tự động đồng bộ các Issue từ Jira FSS (Dự án SBSIUAT) liên quan đến 9 chuyên viên SBSI (Reporter / Assignee)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

const JIRA_BASE_URL = 'https://projects.fss.com.vn';

// Danh sách 9 chuyên viên được chỉ định lọc issue log
const ALLOWED_USERS = [
  'cuongnt.sbsi',
  'anhll.sbsi',
  'bachnt.sbsi',
  'baodk.sbsi',
  'huypn.sbsi',
  'longnh.sbsi',
  'ngamtq.sbsi',
  'quocpb.sbsi',
  'vinhtq.sbsi'
];

// Map username sang tên hiển thị ngắn gọn & phân hệ
const USER_DISPLAY_MAP = {
  'cuongnt.sbsi': 'CuongNT',
  'anhll.sbsi': 'AnhLL',
  'bachnt.sbsi': 'BachNT',
  'baodk.sbsi': 'BaoDK',
  'huypn.sbsi': 'HuyPN',
  'longnh.sbsi': 'LongNH',
  'ngamtq.sbsi': 'NgaMTQ',
  'quocpb.sbsi': 'QuocPB',
  'vinhtq.sbsi': 'VinhTQ',
  'mai.cao': 'Mai.Cao'
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  return handleSync(context);
}

export async function onRequestPost(context) {
  return handleSync(context);
}

async function handleSync(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Cho phép ghi đè qua env nếu có, fallback tài khoản người dùng cấp
  const username = (env && env.JIRA_USER) || 'bachnt.sbsi';
  const password = (env && env.JIRA_PASS) || 'bB;hz,u979Xj#7';
  const authHeader = 'Basic ' + btoa(`${username}:${password}`);

  const includeAll = url.searchParams.get('includeAll') === 'true';
  const maxResults = parseInt(url.searchParams.get('max') || '100', 10);

  // Xây dựng JQL: Lấy các issue được log (reporter) HOẶC được giao (assignee) bởi 9 chuyên viên SBSI
  let jql = 'project = SBSIUAT AND resolution = Unresolved';
  if (!includeAll) {
    const userListStr = ALLOWED_USERS.map(r => `"${r}"`).join(', ');
    jql += ` AND (reporter in (${userListStr}) OR assignee in (${userListStr}))`;
  }
  jql += ' ORDER BY created DESC, assignee DESC, cf[12401] ASC, priority DESC, updated DESC';

  const jiraSearchUrl = `${JIRA_BASE_URL}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`;

  try {
    const jiraResp = await fetch(jiraSearchUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'SBSI-UAT-Portal/1.0'
      }
    });

    if (!jiraResp.ok) {
      const errText = await jiraResp.text();
      return new Response(JSON.stringify({
        success: false,
        error: `Jira API Error ${jiraResp.status}: ${jiraResp.statusText}`,
        details: errText
      }), { status: 200, headers: CORS_HEADERS });
    }

    const jiraData = await jiraResp.json();
    const rawIssues = jiraData.issues || [];

    // Format issues sang chuẩn Portal
    const formattedIssues = rawIssues.map(iss => {
      const f = iss.fields || {};
      const repUser = (f.reporter && f.reporter.name) || '';
      const repName = (f.reporter && (f.reporter.displayName || f.reporter.name)) || 'Chưa rõ';
      const assUser = (f.assignee && f.assignee.name) || '';
      const assName = (f.assignee && (f.assignee.displayName || f.assignee.name)) || 'Chưa gán';
      const baUser = (f.customfield_12401 && (f.customfield_12401.displayName || f.customfield_12401.name)) || '';

      // Chuẩn hóa phân hệ (Platform)
      let platform = 'general';
      const summaryLower = (f.summary || '').toLowerCase();
      if (summaryLower.includes('mobile') || summaryLower.includes('app') || summaryLower.includes('uiux')) {
        platform = 'mobile';
      } else if (summaryLower.includes('web') || summaryLower.includes('online') || summaryLower.includes('đặt lệnh') || summaryLower.includes('bảng giá')) {
        platform = 'web';
      } else if (summaryLower.includes('margin') || summaryLower.includes('vmr') || summaryLower.includes('032007')) {
        platform = 'margin';
      } else if (summaryLower.includes('ci') || summaryLower.includes('tiền')) {
        platform = 'ci';
      } else if (summaryLower.includes('ekyc') || summaryLower.includes('onboard')) {
        platform = 'ekyc';
      } else if (summaryLower.includes('tprl') || summaryLower.includes('bond') || summaryLower.includes('tenora')) {
        platform = 'tenora';
      } else if (summaryLower.includes('flex') || summaryLower.includes('core') || summaryLower.includes('02001') || summaryLower.includes('3390')) {
        platform = 'flex';
      }

      // Chuẩn hóa mức độ Priority
      let priority = 'Medium';
      const priName = (f.priority && f.priority.name) || 'Medium';
      if (priName === 'Blocker' || priName === 'Critical') priority = 'Critical';
      else if (priName === 'High' || priName === 'Major') priority = 'High';
      else if (priName === 'Medium') priority = 'Medium';
      else if (priName === 'Low' || priName === 'Minor' || priName === 'Trivial') priority = 'Low';

      // Chuẩn hóa ngày tháng
      const fmtDate = (isoStr) => {
        if (!isoStr) return '';
        try {
          const d = new Date(isoStr);
          const pad = n => String(n).padStart(2, '0');
          return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch(e) {
          return isoStr;
        }
      };

      return {
        id: iss.key,
        platform: platform,
        title: f.summary || '(Không có tiêu đề)',
        type: (f.issuetype && f.issuetype.name) || 'Bug',
        priority: priority,
        status: (f.status && f.status.name) || 'Open',
        assignee: assName,
        assigneeUser: assUser,
        reporter: repName,
        reporterUser: repUser,
        reporterNick: USER_DISPLAY_MAP[repUser] || repUser,
        ba: baUser,
        desc: f.description || '',
        relatedTc: '',
        jiraUrl: `${JIRA_BASE_URL}/browse/${iss.key}`,
        createdAt: fmtDate(f.created),
        updatedAt: fmtDate(f.updated),
        source: 'JIRA_FSS'
      };
    });

    return new Response(JSON.stringify({
      success: true,
      count: formattedIssues.length,
      totalJira: jiraData.total || 0,
      jql: jql,
      allowedUsers: ALLOWED_USERS,
      issues: formattedIssues,
      syncedAt: new Date().toISOString()
    }), { status: 200, headers: CORS_HEADERS });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown fetch error connecting to Jira FSS'
    }), { status: 200, headers: CORS_HEADERS });
  }
}
