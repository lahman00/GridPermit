import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const layout=readFileSync(new URL("../src/layouts/LocalityGuideLayout.astro",import.meta.url),"utf8");
const cta=readFileSync(new URL("../src/components/InstallerCTA.astro",import.meta.url),"utf8");

test("approved commercial CTA renders before long-form locality sections",()=>{
  const paid=layout.indexOf('mode="commercial-only"');
  const overview=layout.indexOf('<section id="overview">');
  const docs=layout.indexOf('<section id="required-documents">');
  assert.ok(paid>0&&paid<overview&&overview<docs,{paid,overview,docs});
  assert.match(layout,/mode="commercial-only"[\s\S]{0,120}anchorId="installer-cta"/);
});

test("first-lead routes reuse the same compact commercial slot instead of a nested legacy panel",()=>{
  const paid=layout.indexOf('mode="commercial-only"');
  const overview=layout.indexOf('<section id="overview">');
  assert.ok(paid>0&&paid<overview,{paid,overview});
  assert.match(layout,/requireFirstLeadQualification=\{isFirstLeadSprintPage\}/);
  assert.doesNotMatch(layout,/class="first-lead-panel"/);
});

test("unpaid installer resource stays late and is mutually exclusive with paid selection",()=>{
  const contacts=layout.indexOf('<section id="official-contacts">');
  const unpaid=layout.indexOf('mode="resource-only"');
  assert.ok(unpaid>contacts,{contacts,unpaid});
  assert.match(layout,/mode="resource-only" anchorId="installer-cta"/);
  assert.match(cta,/const renderCommercial=Boolean\(selection\)&&mode!=="resource-only"/);
  assert.match(cta,/const renderResource=Boolean\(!selection&&allowUnpaidResource\)&&mode!=="commercial-only"/);
});

test("mode split preserves one route owner and does not duplicate CSP URL or CID logic",()=>{
  assert.match(cta,/type RenderMode = "all" \| "commercial-only" \| "resource-only"/);
  assert.equal((cta.match(/CompareSolarPricesCTA state="CA"/g)||[]).length,1);
  assert.doesNotMatch(cta,/ref=GridPermit|generateCompareSolarCid|buildCompareSolarReferralUrl/);
});
