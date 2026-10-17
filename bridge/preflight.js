import {syncUrl} from './config.js';

export const issueCopy = {
  server_unreachable: 'LUDIA 서버에 연결하지 못했어요. 인터넷 연결을 확인하세요.',
  invalid_server_response: 'LUDIA 서버의 응답 형식을 확인하지 못했어요.',
  supabase_not_configured: '서버 저장소 연결 설정이 아직 준비되지 않았어요.',
  salon_not_configured: '서버의 실제 매장 등록을 확인하지 못했어요.',
  sync_token_not_configured: '서버의 PC 전송 권한 설정이 아직 준비되지 않았어요.',
  configuration_unavailable: '서버가 저장소 연결 상태를 확인하지 못했어요.',
  unauthorized: 'PC 연결 키가 서버와 맞지 않아요.',
  sync_key_required: '서버와 같은 매장 PC 연결 키를 입력하세요.',
  sync_schema_not_ready: '서버의 예약 저장 기능 설정을 확인해야 해요.',
  server_not_ready: '서버 연결 준비가 끝나지 않았어요.',
  official_ludia_endpoint_required: '현재 LUDIA 공식 HTTPS 주소만 사용할 수 있어요.'
};

export async function checkServer(config, fetcher = fetch) {
  const endpoint = syncUrl(config.syncUrl);
  let health;
  try {
    const response = await fetcher(endpoint, {headers: {accept: 'application/json'}, signal: AbortSignal.timeout(15000), redirect: 'error'});
    health = await response.json();
    if (!response.ok) return {ok: false, issues: [health.error === 'configuration_unavailable' ? health.error : 'server_not_ready']};
  } catch { return {ok: false, issues: ['server_unreachable']}; }
  if (!health || health.service !== 'ludia-naver-sync' || typeof health.ready !== 'boolean') return {ok: false, issues: ['invalid_server_response']};
  const issues = [];
  if (!health.supabaseConfigured) issues.push('supabase_not_configured');
  if (!health.salonConfigured) issues.push('salon_not_configured');
  if (!health.tokenConfigured) issues.push('sync_token_not_configured');
  if (!health.ready || issues.length) return {ok: false, issues: issues.length ? issues : ['server_not_ready']};
  if (!config.syncToken || config.syncToken.length < 32) return {ok: false, issues: ['sync_key_required']};
  try {
    const response = await fetcher(endpoint, {method: 'POST', headers: {authorization: 'Bearer ' + config.syncToken, 'content-type': 'application/json'},
      body: JSON.stringify({source: 'NAVER', probe: true}), signal: AbortSignal.timeout(15000), redirect: 'error'});
    const data = await response.json();
    if (!response.ok || data.ok !== true || data.probe !== true || data.writable !== true || data.mutated !== false) return {ok: false, issues: [Object.hasOwn(issueCopy, data.error) ? data.error : 'server_not_ready']};
    return {ok: true, issues: []};
  } catch { return {ok: false, issues: ['server_unreachable']}; }
}
