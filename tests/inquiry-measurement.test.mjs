import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/pages/partner-inquiry.astro', import.meta.url), 'utf8');
const script = source.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
function harness(hostname = 'mygridpermit.com', tag = true) {
 const calls = [], listeners = [];
 class Element { constructor(action) { this.action = action; } closest() { return this.action === null ? null : this; } getAttribute() { return this.action; } }
 const window = tag ? {gtag: (...args) => calls.push(args)} : {};
 const context = vm.createContext({window, location: {hostname}, document: {addEventListener: (name, fn) => listeners.push(fn)}, Element});
 vm.runInContext(script, context);
 return {calls, listeners, window, context, Element, click(action) { for(const fn of listeners) fn({target:new Element(action)}); }};
}
test('inquiry view once per document; compose and fallback clicks carry only fixed categories', () => {
 const h = harness();
 vm.runInContext(script, h.context);
 assert.equal(h.listeners.length,1);
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0][1],'inquiry_page_viewed');
 h.click('compose'); h.click('address'); h.click(null); h.click('email=user@example.com');
 assert.deepEqual(h.calls.map(x => x[1]), ['inquiry_page_viewed','inquiry_email_clicked','inquiry_email_clicked']);
 assert.deepEqual(h.calls.slice(1).map(x => x[2].inquiry_action), ['compose','address']);
 for(const call of h.calls) { assert.equal(call[0],'event'); assert.equal(call[2].page_location,'https://mygridpermit.com/partner-inquiry/'); assert.ok(Object.keys(call[2]).every(k => ['page_location','inquiry_action'].includes(k))); }
});
test('inquiry tracking is silent on previews and tolerates absent/throwing analytics', () => {
 for(const host of ['localhost','gridpermit-migration.vercel.app','mygridpermit.com.attacker.example']) { const h=harness(host); h.click('compose'); assert.equal(h.calls.length,0); assert.equal(h.listeners.length,0); }
 const h=harness('mygridpermit.com',false); assert.doesNotThrow(()=>h.click('compose'));
 h.window.gtag=()=>{throw Error('blocked')}; assert.doesNotThrow(()=>h.click('compose'));
 const www=harness('www.mygridpermit.com'); assert.equal(www.calls.length,1);
});
test('page keeps native email handoff and uses no new tracking loader or submit handler', () => {
 assert.match(source,/href=\{inquiryHref\} data-inquiry-email="compose"/);
 assert.match(source,/href="mailto:support@mygridpermit.com" data-inquiry-email="address"/);
 assert.doesNotMatch(script,/preventDefault|fetch\(|sendBeacon|localStorage|sessionStorage|\.href|\.search|\.value/);
 assert.doesNotMatch(script,/gtag\('config'|googletagmanager/);
});
