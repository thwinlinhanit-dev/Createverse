/**
 * P1-14 — Smoke journey 1 (TESTING.md §8): "Parent registers with a passkey,
 * creates a child profile, registers the device."
 *
 * Runs against the real API (backend/src/serve.ts --e2e, fresh SQLite per
 * run) through the vite /api proxy, same-origin, on the localhost origin so
 * the WebAuthn RP ID ("localhost") matches. The ceremony itself runs inside
 * the page with navigator.credentials on a CDP **virtual authenticator** —
 * the same code path the app will use once the app-side identity client
 * lands (P1-18 owns the parent session UI; the gate's confirm button still
 * stands in for it).
 *
 * Hygiene (TESTING.md §8): no fixed sleeps, one test-only seeding path
 * (POST /e2e/reset — mounted by serve.ts only, never by createApp).
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const APP_ORIGIN = "http://localhost:5173";
const SETUP_SECRET = "e2e-setup-secret";

interface CeremonyResult {
  familyId: string;
  userId: string;
  parentSession: string;
  parentRole: string;
  deviceId: string;
  deviceCredential: string;
  childId: string;
  childName: string;
  childSession: string;
  childRole: string;
  childSessionChildId: string | null;
}

async function attachVirtualAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

/**
 * Full setup flow in the page: bootstrap → registration ceremony → login
 * ceremony → device + child creation → child profile open. Binary WebAuthn
 * fields are base64url-encoded into the strict JSON shapes API_SPEC §5.1
 * defines (see WebAuthnAttestationShape/WebAuthnAssertionShape).
 */
async function runSetupCeremony(page: Page): Promise<CeremonyResult> {
  return page.evaluate(async (secret) => {
    function toB64url(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    function fromB64url(value: string): ArrayBuffer {
      const padded = value.replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
    async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
      const res = await fetch(path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    }
    async function getSession(token: string): Promise<{ role: string; family_id: string; child_id: string | null }> {
      const res = await fetch("/api/v1/auth/session", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`session -> ${res.status}`);
      return (await res.json()) as { role: string; family_id: string; child_id: string | null };
    }

    // The server emits literal "public-key" types; mirroring them here keeps
    // the navigator.credentials argument type-safe (TS strict).
    type PubKeyParam = { type: "public-key"; alg: number };
    type CredDescriptor = { id: string; type: "public-key"; transports?: string[] };
    interface RegOptions {
      options: {
        challenge: string;
        rp: { name: string };
        user: { id: string; name: string; displayName: string };
        pubKeyCredParams: PubKeyParam[];
        timeout?: number;
        excludeCredentials?: CredDescriptor[];
        authenticatorSelection?: Record<string, unknown>;
        attestation?: string;
      };
    }
    interface AuthOptions {
      options: {
        challenge: string;
        rpId?: string;
        allowCredentials?: CredDescriptor[];
        userVerification?: string;
        timeout?: number;
      };
    }

    // 1. Bootstrap the family + first parent (single-use secret).
    const boot = await post<{ family_id: string; user_id: string; session_token: string }>(
      "/api/v1/setup/bootstrap",
      { setup_secret: secret, email: "parent@e2e.test", family_name: "E2E Family" },
    );

    // 2. Registration ceremony (bootstrap session is fresh by spec).
    const reg = await post<RegOptions>(
      "/api/v1/auth/passkeys/register/options",
      {},
      boot.session_token,
    );
    const created = (await navigator.credentials.create({
      publicKey: {
        challenge: fromB64url(reg.options.challenge),
        rp: { name: reg.options.rp.name },
        user: {
          id: fromB64url(reg.options.user.id),
          name: reg.options.user.name,
          displayName: reg.options.user.displayName,
        },
        pubKeyCredParams: reg.options.pubKeyCredParams,
        timeout: reg.options.timeout,
        excludeCredentials: reg.options.excludeCredentials?.map((c) => ({
          id: fromB64url(c.id),
          type: c.type,
          transports: c.transports as AuthenticatorTransport[],
        })),
        authenticatorSelection: reg.options.authenticatorSelection as AuthenticatorSelectionCriteria,
        attestation: (reg.options.attestation ?? "none") as AttestationConveyancePreference,
      },
    })) as PublicKeyCredential | null;
    if (!created) throw new Error("navigator.credentials.create returned null");
    const att = created.response as AuthenticatorAttestationResponse;
    await post(
      "/api/v1/auth/passkeys/register/verify",
      {
        response: {
          id: created.id,
          rawId: toB64url(created.rawId),
          type: created.type,
          response: {
            clientDataJSON: toB64url(att.clientDataJSON),
            attestationObject: toB64url(att.attestationObject),
            transports: att.getTransports(),
          },
        },
      },
      boot.session_token,
    );

    // 3. Login ceremony → parent session.
    const loginOpts = await post<AuthOptions>("/api/v1/auth/login/options", {});
    const asserted = (await navigator.credentials.get({
      publicKey: {
        challenge: fromB64url(loginOpts.options.challenge),
        rpId: loginOpts.options.rpId,
        allowCredentials: loginOpts.options.allowCredentials?.map((c) => ({
          id: fromB64url(c.id),
          type: c.type,
          transports: c.transports as AuthenticatorTransport[],
        })),
        userVerification: (loginOpts.options.userVerification ?? "preferred") as UserVerificationRequirement,
        timeout: loginOpts.options.timeout,
      },
    })) as PublicKeyCredential | null;
    if (!asserted) throw new Error("navigator.credentials.get returned null");
    const assertion = asserted.response as AuthenticatorAssertionResponse;
    const login = await post<{ session_token: string }>("/api/v1/auth/login/verify", {
      response: {
        id: asserted.id,
        rawId: toB64url(asserted.rawId),
        type: asserted.type,
        response: {
          clientDataJSON: toB64url(assertion.clientDataJSON),
          authenticatorData: toB64url(assertion.authenticatorData),
          signature: toB64url(assertion.signature),
          userHandle: assertion.userHandle ? toB64url(assertion.userHandle) : null,
        },
      },
    });
    const parentSession = login.session_token;
    const parent = await getSession(parentSession);

    // 4. Register this device + create the child profile (parent+fresh — the
    //    login session is seconds old, inside the 5-minute fresh window).
    const device = await post<{ id: string; credential: string }>(
      "/api/v1/devices",
      { label: "E2E Phone" },
      parentSession,
    );
    const child = await post<{ id: string; display_name: string }>(
      "/api/v1/children",
      { display_name: "E2E Child", stage: "explorer", locale: "en" },
      parentSession,
    );

    // 5. The device opens the child profile (device role, credential header).
    const openRes = await fetch(`/api/v1/children/${child.id}/open`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-device-credential": device.credential,
      },
      body: "{}",
    });
    if (!openRes.ok) throw new Error(`child open -> ${openRes.status}: ${await openRes.text()}`);
    const open = (await openRes.json()) as {
      session_token: string;
      child: { id: string; display_name: string };
    };
    const childSession = await getSession(open.session_token);

    return {
      familyId: boot.family_id,
      userId: boot.user_id,
      parentSession,
      parentRole: parent.role,
      deviceId: device.id,
      deviceCredential: device.credential,
      childId: child.id,
      childName: open.child.display_name,
      childSession: open.session_token,
      childRole: childSession.role,
      childSessionChildId: childSession.child_id,
    };
  }, SETUP_SECRET);
}

test("parent passkey setup → device + child profile → child session opens", async ({
  page,
  request,
}: {
  page: Page;
  request: APIRequestContext;
}) => {
  // Fresh family for this test — also makes retried runs deterministic.
  const reset = await request.post(`${APP_ORIGIN}/api/v1/e2e/reset`);
  expect(reset.ok()).toBeTruthy();

  await page.goto(`${APP_ORIGIN}/`);
  await attachVirtualAuthenticator(page);
  const result = await runSetupCeremony(page);

  expect(result.familyId).toMatch(/^f_/);
  expect(result.userId).toMatch(/^u_/);
  // Parent session opens and reports the parent role.
  expect(result.parentRole).toBe("parent");
  // Device + child created through parent+fresh routes.
  expect(result.deviceId).toMatch(/^d_/);
  expect(result.deviceCredential.length).toBeGreaterThan(20);
  expect(result.childId).toMatch(/^c_/);
  expect(result.childName).toBe("E2E Child");
  // The device-credential open yields a child session scoped to that child.
  expect(result.childRole).toBe("child");
  expect(result.childSessionChildId).toBe(result.childId);
});
