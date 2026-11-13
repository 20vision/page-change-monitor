import { Actor, log } from 'apify';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

await Actor.init();
const input = (await Actor.getInput()) || {};
const urls = [...new Set((input.urls || []).map((u) => String(u).trim()).filter(Boolean))];
const selector = String(input.selector || '').trim();
if (!urls.length) await Actor.fail('No page addresses given. Add at least one address, for example https://www.example.com');

const store = await Actor.openKeyValueStore('page-change-monitor-state');
const UA = 'Mozilla/5.0 (compatible; PageChangeMonitor/1.0; +https://apify.com/20vision/page-change-monitor)';
const BLOCKS = 'p,div,section,article,header,footer,main,nav,aside,li,ul,ol,tr,table,h1,h2,h3,h4,h5,h6,br,blockquote,pre,dt,dd,figure,form';

function lines(html) {
  const $ = cheerio.load(html);
  $('script,style,noscript,template,svg').remove();
  const root = selector ? $(selector) : $('body');
  if (!root.length) return null;
  root.find(BLOCKS).each((_, el) => { $(el).append('\n').prepend('\n'); });
  return root.text().split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
function diff(oldL, newL) {
  const count = (a) => a.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
  const o = count(oldL), n = count(newL);
  const removed = [], added = [];
  for (const l of oldL) { if ((n.get(l) || 0) > 0) n.set(l, n.get(l) - 1); else removed.push(l); }
  for (const l of newL) { if ((o.get(l) || 0) > 0) o.set(l, o.get(l) - 1); else added.push(l); }
  return { added, removed };
}

let changed = 0, first = 0, errors = 0;
for (const url of urls) {
  const checkedAt = new Date().toISOString();
  const key = 'PAGE_' + createHash('sha256').update(url + '|' + selector).digest('hex').slice(0, 32);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const now = lines(await r.text());
    if (!now) throw new Error(`Selector "${selector}" matched nothing on the page`);
    const prev = await store.getValue(key);
    await store.setValue(key, { url, selector, savedAt: checkedAt, lines: now });
    if (!prev) { first++; await Actor.pushData({ url, status: 'first read', added: [], removed: [], lineCount: now.length, checkedAt }); continue; }
    const { added, removed } = diff(prev.lines, now);
    const isChanged = added.length + removed.length > 0;
    if (isChanged) changed++;
    await Actor.pushData({ url, status: isChanged ? 'changed' : 'not changed', added, removed, lineCount: now.length, checkedAt });
  } catch (e) {
    errors++;
    await Actor.pushData({ url, status: 'error', error: String(e.message || e).slice(0, 200), added: [], removed: [], checkedAt });
  }
}
log.info(`SUMMARY: ${urls.length} pages: ${first} first read, ${changed} changed, ${urls.length - first - changed - errors} not changed, ${errors} errors.`);
await Actor.exit();
