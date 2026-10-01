import test from "node:test";
import assert from "node:assert/strict";
import solarCom from "../data/commercial/partners/solar-com.json" with { type: "json" };
import { partnerConfigErrors } from "../src/lib/commercial/partner-platform.ts";

test("Solar.com stays fail-closed until explicit approval and tracking are received", () => {
  assert.deepEqual(partnerConfigErrors(solarCom), []);
  assert.equal(solarCom.status, "SHADOW");
  assert.equal(solarCom.tracking.active, false);
  assert.equal(solarCom.destination, null);
  assert.equal(solarCom.approval_reference, null);
  assert.equal(solarCom.commercial_status, "UNVERIFIED");
  assert.equal(solarCom.qualification.existing_solar, "REJECT");
  assert.deepEqual(solarCom.program.allowed_intents, ["NEW_SOLAR", "BATTERY_NEW_INSTALL"]);
});
