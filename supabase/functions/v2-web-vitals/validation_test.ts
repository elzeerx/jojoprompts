import { assertEquals } from "jsr:@std/assert@1";
import {
  environmentForOrigin,
  ratingForMetric,
  toSamples,
  validateWebVitalBatch,
} from "./validation.ts";

const validBatch = {
  route: "/explore",
  viewport_width: 390,
  metrics: [{
    name: "LCP",
    value: 2400,
    id: "v6-1234-abc",
    navigation_type: "navigate",
  }],
};

Deno.test("accepts a minimal valid batch and derives server fields", () => {
  const result = validateWebVitalBatch(validBatch);
  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(toSamples(result.value, "preview"), [{
    metric_name: "LCP",
    value: 2400,
    rating: "good",
    route_path: "/explore",
    device_class: "mobile",
    environment: "preview",
    navigation_type: "navigate",
    metric_id: "v6-1234-abc",
  }]);
});

Deno.test("rejects query strings, unknown fields, duplicate metrics, and invalid values", () => {
  assertEquals(
    validateWebVitalBatch({ ...validBatch, route: "/explore?q=secret" }),
    { ok: false, error: "invalid_route" },
  );
  assertEquals(
    validateWebVitalBatch({ ...validBatch, user_id: "not-allowed" }),
    { ok: false, error: "invalid_payload" },
  );
  assertEquals(
    validateWebVitalBatch({
      ...validBatch,
      metrics: [validBatch.metrics[0], validBatch.metrics[0]],
    }),
    { ok: false, error: "invalid_metric_name" },
  );
  assertEquals(
    validateWebVitalBatch({
      ...validBatch,
      metrics: [{ ...validBatch.metrics[0], value: 999999 }],
    }),
    { ok: false, error: "invalid_metric_value" },
  );
});

Deno.test("origin mapping is exact and fail closed", () => {
  assertEquals(environmentForOrigin("https://jojoprompts.com"), "production");
  assertEquals(
    environmentForOrigin(
      "https://id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app",
    ),
    "preview",
  );
  assertEquals(
    environmentForOrigin("https://jojoprompts.com.attacker.example"),
    null,
  );
  assertEquals(environmentForOrigin(null), null);
});

Deno.test("ratings use canonical Core Web Vitals thresholds", () => {
  assertEquals(ratingForMetric("LCP", 2500), "good");
  assertEquals(ratingForMetric("LCP", 2501), "needs-improvement");
  assertEquals(ratingForMetric("INP", 501), "poor");
  assertEquals(ratingForMetric("CLS", 0.1), "good");
  assertEquals(ratingForMetric("CLS", 0.101), "needs-improvement");
});
