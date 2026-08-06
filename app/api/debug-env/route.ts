import { NextRequest, NextResponse } from 'next/server';

// TEMPORARY diagnostic route to debug "fetch failed" errors when calling
// Supabase from Vercel serverless functions. Never leaks full secrets —
// only lengths, previews, and whitespace checks. Delete this file once the
// underlying env var issue is fixed.
const DEBUG_TOKEN = 'ef44b4e99f2a239166e94fe62cc25c5a';

function preview(value: string, headLen: number, tailLen: number): string {
  if (!value) return '';
  if (value.length <= headLen + tailLen) return `${value.slice(0, 2)}...(${value.length} chars)`;
  return `${value.slice(0, headLen)}...${value.slice(-tailLen)} (${value.length} chars)`;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== DEBUG_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const url = rawUrl.trim();
  const key = rawKey.trim();

  const diagnostics: Record<string, unknown> = {
    url_set: rawUrl.length > 0,
    url_preview: preview(rawUrl, 28, 12),
    url_has_whitespace: rawUrl !== url,
    url_looks_valid: /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url),
    key_set: rawKey.length > 0,
    key_preview: preview(rawKey, 8, 6),
    key_has_whitespace: rawKey !== key,
    key_looks_like_jwt: key.split('.').length === 3,
  };

  if (!url || !key) {
    diagnostics.verdict = 'One or both env vars are missing/empty in this deployment.';
    return NextResponse.json(diagnostics);
  }

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    diagnostics.fetch_status = res.status;
    diagnostics.fetch_ok = res.ok;
    diagnostics.verdict =
      res.status === 401 || res.status === 403
        ? 'Reached Supabase, but the key was rejected (wrong/rotated service_role key).'
        : res.ok
        ? 'Reached Supabase successfully with these credentials.'
        : `Reached Supabase but got an unexpected status ${res.status}.`;
  } catch (err) {
    diagnostics.fetch_error = err instanceof Error ? err.message : String(err);
    diagnostics.fetch_error_cause =
      err instanceof Error && err.cause ? String(err.cause) : null;
    diagnostics.verdict = 'Network-level failure reaching Supabase (bad URL, DNS, or project paused).';
  }

  return NextResponse.json(diagnostics);
}
