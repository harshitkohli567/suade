# Suade Web Workspace — setup

The web workspace lives at **`suadelaw.com/app`** (sign-in at **`/login`**). It's built
from the same repo and served by the same Node server as the Word add-in — no
separate deploy. This guide covers the one thing that needs manual setup: **Google
sign-in**.

---

## 1. Create a Google OAuth Client ID

You need a Google Cloud project with an OAuth 2.0 **Web** client. ~10 minutes.

1. Go to <https://console.cloud.google.com/> and sign in.
2. **Create a project** (top bar → project dropdown → *New Project*). Name it
   e.g. `Suade`. Select it once created.
3. In the search bar, go to **APIs & Services → OAuth consent screen**.
   - **User type:** *External* → *Create*.
   - App name: `Suade`. User support email: your email.
   - Developer contact: your email. **Save and continue.**
   - *Scopes* screen: you don't need to add any — Suade only uses the basic
     sign-in identity (email, name, picture). **Save and continue.**
   - *Test users*: while the app is in "Testing" mode, only emails you add here
     can sign in. Add your own email (and any teammates) — **or** publish the app
     (*Publishing status → Publish app*) so **anyone with a Google account** can
     sign in, which is the intended v1 behavior. **Save.**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - **Application type:** *Web application*.
   - Name: `Suade Web`.
   - **Authorized JavaScript origins** — add both:
     - `https://suadelaw.com`
     - `https://localhost:3000` (for local dev)
   - You can leave **Authorized redirect URIs** empty — Suade uses Google
     Identity Services (a token popup), not a redirect flow.
   - **Create.**
5. Copy the **Client ID** (looks like `1234567890-abc123.apps.googleusercontent.com`).
   You don't need the client *secret*.

> If you later serve the workspace on another domain (e.g. `app.suadelaw.com`),
> add that origin here too, or sign-in will be blocked.

---

## 2. Set the server environment variables

Two variables:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the Client ID from step 1.5 |
| `SESSION_SECRET` | a long random string — run `openssl rand -hex 32` |

### Production (Render)
Render dashboard → the `suade-addin` service → **Environment** → add both keys →
**Save changes** (this redeploys). They're already declared in `render.yaml` as
`sync: false`, so Render just needs the values.

### Local dev
Add to `.env` in the repo root:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
SESSION_SECRET=your-random-hex-string
```

---

## 3. Run it

- **Production:** push to the deploy branch; Render runs `npm run build` (which now
  also builds the `webapp` bundle) and serves `/app` + `/login`.
- **Local dev:** two processes, as before —
  ```bash
  npm run server       # API on https://localhost:3001
  npm run dev-server   # webapp + task pane on https://localhost:3000
  ```
  Then open <https://localhost:3000/login>. The dev server proxies `/api` to
  `:3001` so the session cookie stays first-party.

If `GOOGLE_CLIENT_ID` is missing, the login page shows a "not configured" notice
instead of the Google button — that's the expected fallback, not a bug.

---

## What the workspace does (v1)

1. **Matter & documents** — enter a Matter ID (pulls a document-classification
   summary via a connector preview) *or* upload the case file and have Claude
   classify each doc into Contracts / Pleadings / Exhibits / Witness Statements /
   Affidavits / Corporate Registry.
2. **Case theory** — three fields (Facts / Law / Client goals), or upload a
   client-meeting transcript and Suade drafts them for you.
3. **Draft** — pick a document type (Request for Arbitration, Statement of Claim,
   Statement of Defense & Counterclaim, Statement of Reply, Statement of
   Rejoinder, Witness Statement). Suade shows the Skill sequence + a time
   estimate, runs them, and returns two channels: **Draft** and **Working Notes**.

### Known v1 limitations (fast-follow)
- **Matter ID → documents** uses a **connector stub** (deterministic, realistic
  summary). Real per-user Google Drive / Dropbox sync is the next integration.
- Only **Statement of Claim** has a full bespoke Skill set. The other document
  types reuse a labeled subset of those Skills as an approximation for now.
- Access is **any Google account** (or your OAuth test-user list). To restrict to
  an email/domain allowlist, gate on `payload.email` in `serverAuth.js`
  (`verifyGoogleCredential`).
