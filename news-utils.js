const PRIVATE_IPV4 = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
const PRIVATE_IPV6 = /^(::1|fc|fd|fe80:)/i;

function isSafePublicUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || PRIVATE_IPV4.test(hostname) || PRIVATE_IPV6.test(hostname)) return false;
    if (url.port && !['80', '443'].includes(url.port)) return false;
    return Boolean(hostname && hostname.includes('.'));
  } catch { return false; }
}

function cleanNewsSummary(value, limit = 900) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function normalizeNewsUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'news.google.com' || hostname === 'google.com' || hostname.endsWith('.google.com')) return '';
    return url.href;
  } catch { return ''; }
}

function buildDomesticSearchUrl(title, platform = 'baidu') {
  const query = encodeURIComponent(String(title || '').trim());
  if (!query) return '';
  return platform === 'weibo' ? `https://s.weibo.com/weibo?q=${query}` : `https://www.baidu.com/s?wd=${query}`;
}

if (typeof module !== 'undefined') module.exports = { isSafePublicUrl, cleanNewsSummary, normalizeNewsUrl, buildDomesticSearchUrl };
if (typeof window !== 'undefined') window.NewsUtils = { isSafePublicUrl, cleanNewsSummary, normalizeNewsUrl, buildDomesticSearchUrl };
