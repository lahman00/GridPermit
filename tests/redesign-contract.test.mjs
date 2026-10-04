import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFileSync(path.join(ROOT,file),'utf8');
const head=read('src/components/DesignHead.astro');
const analytics=read('src/components/Analytics.astro');
const layout=read('src/layouts/LocalityGuideLayout.astro');
const css=read('src/styles/global.css');
const quick=read('src/components/QuickSearch.astro');
const directory=read('src/components/DirectoryFilter.astro');
const inlineScripts=source=>Array.from(source.matchAll(/<script is:inline(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),match=>match[1]);

function analyticsHarness(hostname){
 const appended=[];
 const window={location:{hostname}};
 const document={head:{append:element=>appended.push(element)},createElement:tag=>({tagName:tag})};
 vm.runInNewContext(inlineScripts(analytics)[0],{window,document,Date});
 return {window,appended};
}

test('production analytics keeps the existing property and event initialization contract',()=>{
 for(const hostname of ['mygridpermit.com','www.mygridpermit.com']){
  const {window,appended}=analyticsHarness(hostname);
  assert.equal(typeof window.gtag,'function');
  assert.equal(appended.length,1);
  assert.equal(appended[0].async,true);
  assert.equal(appended[0].src,'https://www.googletagmanager.com/gtag/js?id=G-PGX9SJ9QLG');
  assert.equal(window.dataLayer[0][0],'js');
  assert.equal(window.dataLayer[1][0],'config');
  assert.equal(window.dataLayer[1][1],'G-PGX9SJ9QLG');
 }
});

test('local, Netlify preview and lookalike hosts cannot load or initialize production analytics',()=>{
 for(const hostname of ['localhost','127.0.0.1','deploy-preview-123--gridpermit.netlify.app','mygridpermit.com.example.org','notmygridpermit.com']){
  const {window,appended}=analyticsHarness(hostname);
  assert.equal(window.gtag,undefined,hostname);
  assert.equal(window.dataLayer,undefined,hostname);
  assert.deepEqual(appended,[],hostname);
 }
});

function previewHarness(hostname){
 const listeners=[];
 const notes=[];
 class Element {
  constructor(trigger=null){this.trigger=trigger;}
  closest(){return this.trigger;}
 }
 class HTMLFormElement extends Element {
  constructor(method,id=''){super();this.method=method;this.id=id;}
  getAttribute(name){return name==='method'?this.method:null;}
  hasAttribute(){return false;}
  querySelector(){return null;}
  append(note){notes.push(note);}
 }
 const document={documentElement:{dataset:{}},querySelectorAll:()=>[],addEventListener:(type,handler,capture)=>listeners.push({type,handler,capture}),createElement:()=>({dataset:{},setAttribute(){}})};
 vm.runInNewContext(inlineScripts(head).at(-1),{location:{hostname},document,Element,HTMLFormElement});
 return {document,listeners,notes,Element,HTMLFormElement};
}

test('preview safety is completely inert on the exact production hosts',()=>{
 for(const host of ['mygridpermit.com','www.mygridpermit.com']){
  const result=previewHarness(host);
  assert.deepEqual(result.listeners,[]);
  assert.equal(result.document.documentElement.dataset.previewSafety,undefined);
 }
});

test('preview partner action is stopped in capture phase before the referral click listener',()=>{
 const result=previewHarness('deploy-preview-123--gridpermit.netlify.app');
 assert.equal(result.document.documentElement.dataset.previewSafety,'active');
 const listener=result.listeners.find(item=>item.type==='click');
 assert.equal(listener.capture,true);
 const trigger=new result.Element();
 const target=new result.Element(trigger);
 let prevented=false,stopped=false;
 listener.handler({target,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
 assert.equal(prevented,true);assert.equal(stopped,true);
});

test('preview blocks POST intake without breaking GET search or the local calculator',()=>{
 const result=previewHarness('localhost');
 const listener=result.listeners.find(item=>item.type==='submit');
 assert.equal(listener.capture,true);
 for(const [method,id,blocked] of [['post','partner-inquiry',true],['get','hero-search-form',false],['post','solar-form',false]]){
  let stopped=false;
  listener.handler({target:new result.HTMLFormElement(method,id),preventDefault(){stopped=true;},stopImmediatePropagation(){}});
  assert.equal(stopped,blocked,`${method}/${id}`);
 }
});

test('locality summary uses the recorded authority and independently guards utility ambiguity',()=>{
 assert.match(layout,/hasVerifiedUnambiguousUtility\(record\)/);
 assert.match(layout,/\{permitAuthorityLabel\}/);
 assert.match(layout,/Confirm utility for your address/);
 assert.match(layout,/record\.eligibility_constraints\?\.value\?\.program_or_pathway \?\? NOT_VERIFIED/);
 assert.match(layout,/timeline\?\.standardPathCaveat/);
 assert.match(layout,/Project-specific eligibility conditions apply/);
 assert.doesNotMatch(layout,/Your solar permit\s*starts with the City|Likely eligible|2–4 weeks/);
});

test('checklist is a local planning aid with source conditions and boolean-only device persistence, not a permit-readiness score',()=>{
 assert.match(layout,/type="checkbox" data-checklist-item/);
 assert.match(layout,/\{doc\.name\}/);
 assert.match(layout,/\{doc\.required_when\}/);
 assert.match(layout,/not confirmation of permit readiness/);
 const script=Array.from(layout.matchAll(/<script>([\s\S]*?)<\/script>/g),m=>m[1]).find(s=>s.includes('const checks ='));
 assert.ok(script);
 assert.match(script,/navigator\.clipboard\.writeText/);
 assert.match(script,/canonical/);
 assert.match(script,/gridpermit:checklist:\$\{window\.location\.pathname\}/);
 assert.match(script,/JSON\.stringify\(checks\.map\(item => item\.checked\)\)/);
 assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|sendBeacon|sessionStorage/);
});

test('sources, section anchors and native print disclosure remain available',()=>{
 for(const id of ['required-documents','permit-authority','utility-supplier','sources','official-contacts','permit-fees'])assert.ok(layout.includes(`id="${id}"`),id);
 assert.match(layout,/gp-source-evidence/);
 assert.match(layout,/sourcesFor\(/);
 assert.match(layout,/source\.accessed_date|src\.accessed_date|s\.accessed_date/);
 assert.match(layout,/beforeprint/);assert.match(layout,/afterprint/);
 assert.match(css,/scroll-padding-top: 8rem/);
});

test('instant discovery reuses the existing matcher and emits no query telemetry or remote requests',()=>{
 assert.match(quick,/buildSearchIndex/);assert.match(quick,/searchEntries\(index, q\)/);
 assert.match(quick,/action="\/search\/" method="get"/);
 assert.match(quick,/title\.textContent = result\.title/);
 assert.doesNotMatch(quick,/fetch\(|XMLHttpRequest|sendBeacon|trackEvent\(/);
 assert.match(quick,/ArrowDown/);assert.match(quick,/Escape/);
 assert.doesNotMatch(quick,/placeholder="[^"]*ZIP/);
 assert.match(directory,/card\.hidden/);assert.match(directory,/aria-live="polite"/);
});

test('theme, keyboard focus, reduced motion and filtered-content visibility are shared primitives',()=>{
 assert.match(css,/:root\[data-theme='light'\]/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion: reduce/);
 assert.match(css,/\[hidden\], \.hidden \{ display: none !important/);
 assert.match(read('src/components/Header.astro'),/event\.key !== 'Escape'/);
 assert.match(read('src/components/Header.astro'),/aria-label="Mobile navigation"/);
});

function astroFiles(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?astroFiles(path.join(dir,entry.name)):entry.name.endsWith('.astro')?[path.join(dir,entry.name)]:[]);}
test('every document page uses the same header, footer and appearance system',()=>{
 const documents=[...astroFiles(path.join(ROOT,'src/pages')),...astroFiles(path.join(ROOT,'src/layouts'))].filter(file=>readFileSync(file,'utf8').includes('<html'));
 assert.ok(documents.length>=28);
 for(const file of documents){const source=readFileSync(file,'utf8');assert.match(source,/<Header[\s/>]/,file);assert.match(source,/<Footer[\s/>]/,file);assert.match(source,/<DesignHead|<BaseHead/,file);assert.doesNotMatch(source,/<nav class="navbar"/,file);}
});


test('published state pages participate in the shared search index, including states with no published city', async()=>{
 const {buildSearchIndex,searchEntries}=await import('../src/lib/search-index.ts');
 const index=buildSearchIndex({localityEntries:[],blogPosts:[],states:[{name:'Ohio',slug:'ohio'},{name:'California',slug:'california'}]});
 assert.equal(searchEntries(index,'Ohio')[0]?.url,'/ohio/');
 assert.equal(index.filter(entry=>entry.url==='/california/').length,1);
 assert.equal(index.find(entry=>entry.url==='/ohio/').category,'State');
 for(const file of ['src/components/QuickSearch.astro','src/pages/search.astro']){
  assert.match(read(file),/states: SUPPORTED_STATE_CODES.map/);
  assert.match(read(file),/countyHubs: .*filter\(hub => hub.state === 'CA'\)/);
  assert.match(read(file),/utilityHubs: .*filter\(hub => hub.state === 'CA'\)/);
 }
});

test('locality document order presents facts before the next-step action, without concatenating the city heading',()=>{
 const hero=layout.slice(layout.indexOf('<div class="gp-locality-head">'),layout.indexOf('<p class="subtitle gp-locality-context">'));
 assert.match(hero,/\{record.city.value\} <span>Solar Permit Guide/);
 assert.ok(hero.indexOf('<dl class="gp-facts"')<hero.indexOf('class="gp-button gp-locality-actions"'));
 assert.match(css,/grid-template-areas: "intro" "facts" "action"/);
});


test('preview prevents alternate-click and context-menu partner navigation, including calculator links',()=>{
 const result=previewHarness('localhost');
 const aux=result.listeners.find(item=>item.type==='auxclick');
 assert.equal(aux.capture,true);
 let stopped=false;
 aux.handler({target:new result.Element(new result.Element()),preventDefault(){stopped=true;},stopImmediatePropagation(){}});
 assert.equal(stopped,true);
 const attributes=new Map([['href','https://partner.example/'],['target','_blank']]);
 const anchor={tagName:'A',setAttribute:(name,value)=>attributes.set(name,value),removeAttribute:name=>attributes.delete(name)};
 result.document.querySelectorAll=selector=>selector.startsWith('section.')?[]:[anchor];
 result.listeners.find(item=>item.type==='DOMContentLoaded').handler();
 assert.equal(attributes.get('href'),'#');
 assert.equal(attributes.get('aria-disabled'),'true');
 assert.equal(attributes.has('target'),false);
 assert.match(head,/\.btn-green-action-link/);
});


test('mobile navigation stays scrollable within short viewports',()=>{
 assert.match(css,/\.gp-mobile-menu nav \{[^}]*max-height: calc\(100dvh - 68px\)/);
 assert.match(css,/\.gp-mobile-menu nav \{[^}]*overflow-y: auto/);
});

test('directory county filtering indexes canonical county metadata rather than only rendered card text',()=>{
 assert.match(directory,/card.dataset.filterText/);
 for(const file of ['src/pages/california/solar-permit-guides.astro','src/pages/[state]/index.astro']) assert.match(read(file),/data-filter-text=\{\[entry.city, entry.county/);
 assert.match(read('src/pages/california/county/[slug].astro'),/data-filter-text=\{hub.county\}/);
 assert.match(read('src/pages/california/utility/[slug].astro'),/data-filter-text=\{\[c.county, hub.utilityShort/);
});

test('quick-search arrow navigation excludes links inside any hidden container',()=>{
 assert.match(quick,/filter\(link => !link.closest\('\[hidden\]'\)\)/);
});


test('light appearance is available without JavaScript and commercial text inherits accessible theme tokens',()=>{
 const documents=[...astroFiles(path.join(ROOT,'src/pages')),...astroFiles(path.join(ROOT,'src/layouts'))].filter(file=>readFileSync(file,'utf8').includes('<html'));
 for(const file of documents) assert.match(readFileSync(file,'utf8'),/<html lang="en" data-theme="light">/,file);
 assert.match(css,/html:root\[data-theme\] \.compare-solar-cta h2/);
 assert.match(css,/html:root\[data-theme\] \.compare-solar-cta p/);
 assert.match(css,/html:root\[data-theme\] \.installer-cta-box p/);
});
