import test from "node:test";
import assert from "node:assert/strict";
import { getSiteOrigin, absoluteSiteUrl } from "../src/lib/site-url";
import { allowedSocialProvider, socialProviderEnabled } from "../src/lib/auth-providers";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";

test("canonical origin rejects preview, credential and path drift", () => {
  assert.equal(getSiteOrigin(undefined, "production"), "https://nis-hub-ura.vercel.app");
  assert.equal(getSiteOrigin(undefined, "development"), "http://localhost:3000");
  assert.equal(getSiteOrigin("https://nis-hub-ura.vercel.app/", "production"), "https://nis-hub-ura.vercel.app");
  for (const value of ["http://nis-hub-ura.vercel.app", "https://user:pass@nis-hub-ura.vercel.app", "https://nis-hub-ura.vercel.app/preview", "https://nis-hub-ura.vercel.app?next=x"]) {
    assert.throws(() => getSiteOrigin(value, "production"));
  }
  assert.equal(getSiteOrigin("http://localhost:3100", "development"), "http://localhost:3100");
  assert.throws(() => getSiteOrigin("http://localhost:3100", "production"));
  assert.throws(() => absoluteSiteUrl("//untrusted.example"));
  assert.throws(() => absoluteSiteUrl("https://untrusted.example"));
  assert.throws(() => absoluteSiteUrl("/\\untrusted.example"));
});

test("Google is explicitly gated and Azure remains an allowlisted future provider", () => {
  const previousGoogle = process.env.GOOGLE_AUTH_ENABLED;
  const previousAzure = process.env.AZURE_AUTH_ENABLED;
  try {
    delete process.env.GOOGLE_AUTH_ENABLED;
    delete process.env.AZURE_AUTH_ENABLED;
    assert.equal(socialProviderEnabled("google"), false);
    assert.equal(socialProviderEnabled("azure"), false);
    process.env.GOOGLE_AUTH_ENABLED = "true";
    assert.equal(socialProviderEnabled("google"), true);
    assert.equal(socialProviderEnabled("azure"), false);
    assert.equal(allowedSocialProvider("google"), true);
    assert.equal(allowedSocialProvider("azure"), true);
    assert.equal(allowedSocialProvider("github"), false);
  } finally {
    if (previousGoogle === undefined) delete process.env.GOOGLE_AUTH_ENABLED;
    else process.env.GOOGLE_AUTH_ENABLED = previousGoogle;
    if (previousAzure === undefined) delete process.env.AZURE_AUTH_ENABLED;
    else process.env.AZURE_AUTH_ENABLED = previousAzure;
  }
});

test("robots and sitemap advertise only public canonical routes", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://nis-hub-ura.vercel.app";
  try {
    const urls = sitemap().map((entry) => entry.url);
    assert.deepEqual(urls, [
      "https://nis-hub-ura.vercel.app/",
      "https://nis-hub-ura.vercel.app/privacy",
      "https://nis-hub-ura.vercel.app/terms",
    ]);
    const policy = robots();
    assert.equal(policy.sitemap, "https://nis-hub-ura.vercel.app/sitemap.xml");
    const disallowed = JSON.stringify(policy.rules);
    for (const route of ["/auth", "/admin", "/messages", "/profile", "/diary", "/books", "/support", "/api"]) {
      assert.ok(disallowed.includes(route));
      assert.ok(!urls.some((url) => new URL(url).pathname.startsWith(route)));
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});
