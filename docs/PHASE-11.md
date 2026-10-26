# Resuming — Phase 11: Move cheerfulgames.com to Cloudflare

Goal: cheerfulgames.com is registered at Cloudflare instead of Squarespace, so the domain, its DNS, and its email are all in one place. The website and the company email keep working at every step.

This is company housekeeping, not app work. It does not block Phase 10. Apple and Google only need the website and `bhadresh@cheerfulgames.com` to keep working, and they already do.

## Where things stand (9 Oct 2026)

| Part | State |
|------|-------|
| Registrar | Squarespace Domains II LLC. Registered 28 Jul 2018, expires 28 Jul 2027. |
| Transfer lock | On at Squarespace. |
| Nameservers | Cloudflare: `lewis.ns.cloudflare.com`, `sima.ns.cloudflare.com`. Zone is active. |
| Email | Cloudflare Email Routing. `bhadresh@cheerfulgames.com` forwards to Gmail. |
| Google record | CNAME `lskgac5tb6u2` to `gv-mcmn5icix36otc.dv.googlehosted.com`, DNS only. |
| Website | As of 9 Oct 2026: four Squarespace A records (`198.185.159.144`, `198.185.159.145`, `198.49.23.144`, `198.49.23.145`). Squarespace forwarding sends visitors to `https://boardgame-cricket.netlify.app/` with a 302. `www` has no record. The intended destination is now `https://resuming.app`. |
| DNSSEC | Off. |

## How to use this file

Two milestones, in order. Milestone 1 must be done first. The Squarespace forwarding stops working once the domain leaves Squarespace.

## Rules

- Nothing breaks. The website, email forwarding, and the Google record work before, during, and after the transfer.
- The domain's contact details are Cheerful Games Inc and the same address used for D-U-N-S, Apple, and Google Play.
- Do not change the owner name or organization on the domain at Squarespace before the transfer. That starts a 60-day transfer lock.
- Transfer well before the domain expires. Registrars can refuse transfers in the last days before expiry.
- Proxy only the website records (`@` and `www`). The Google CNAME and the email records stay DNS only.

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M1 Website redirect on Cloudflare | P11-01 Replace Squarespace forwarding | S |
| M2 Transfer | P11-02 Unlock and get the code | S |
| | P11-03 Transfer at Cloudflare | S |
| | P11-04 After the transfer | S |

## Milestone 1 — Website redirect on Cloudflare

At the end of M1, Cloudflare sends cheerfulgames.com and www.cheerfulgames.com to the cricket game, and Squarespace no longer has any part in the website.

### P11-01 — Replace Squarespace forwarding

- In Cloudflare DNS, delete the four Squarespace A records for `@`.
- Add an A record for `@` and one for `www`, both `192.0.2.1`, proxied. The address is a placeholder. Cloudflare answers before it is ever used.
- Add a redirect rule: all incoming requests, static, to `https://resuming.app`, status 302. Use 302, not 301, so browsers do not remember it if a company page replaces it. `resuming.app` names Cheerful Games, Inc.
- Leave the Google CNAME, MX, and TXT records as they are.
- Done when `curl -sI https://cheerfulgames.com` and `curl -sI https://www.cheerfulgames.com` both return a 302 to `https://resuming.app`, and a test email to `bhadresh@cheerfulgames.com` still arrives.

## Milestone 2 — Transfer

At the end of M2, the registry lists Cloudflare as the registrar and DNSSEC is on.

### P11-02 — Unlock and get the code

- In Squarespace, open Domains, then cheerfulgames.com.
- Turn off Domain lock (it may be called Transfer lock, or sit under Registration or Transfer domain away).
- Get the authorization code (also called the transfer or EPP code). Copy it exactly.

### P11-03 — Transfer at Cloudflare

- From the Cloudflare account home, go to Domain Registration, then Transfer Domains. Pick cheerfulgames.com.
- Paste the authorization code.
- Pay for one more year at Cloudflare's at-cost price, about $10 for a `.com`. The year is added to the current expiry, so the domain then runs to 28 Jul 2028.
- Contact details: Cheerful Games Inc and the company address.
- If Squarespace emails about the transfer and offers an approve link, approve it. Otherwise the transfer finishes on its own within about 5 days.
- The website, email, and DNS keep working during the wait.

### P11-04 — After the transfer

- In Cloudflare, go to DNS, then Settings, and turn on DNSSEC. With Cloudflare as registrar, it finishes the setup by itself.
- In Squarespace, check that nothing is left to renew or bill for this domain.
- Done when the public registry (RDAP or WHOIS) shows Cloudflare as registrar, the expiry shows 2028, DNSSEC is on, the redirect still works, and a test email still arrives.

## Out of this phase

- A Cheerful Games company page in place of the redirect. After P11-01 it is a swap of one redirect rule for a Cloudflare Pages site.
- A real company mailbox (Google Workspace) instead of forwarding.
- Sending mail as `bhadresh@cheerfulgames.com` from Gmail.
- Moving resuming.me or any other domain.
