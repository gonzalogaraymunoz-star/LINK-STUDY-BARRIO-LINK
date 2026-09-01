# Deploy checklist

## 1. GitHub

Create an empty repository named `LINK-STUDY`, then from the extracted folder:

```bash
git init
git add .
git commit -m "feat: initialize LINK Study"
git branch -M main
git remote add origin https://github.com/YOUR-USER/LINK-STUDY.git
git push -u origin main
```

Do not commit `.env.local`.

## 2. Vercel — LINK STUDY

Import the GitHub repository into Vercel. Use Node 22 and add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINK_STUDY_ADMIN_TOKEN`
- `LINK_MCP_TOKEN`
- `NEXT_PUBLIC_APP_URL`
- `MIROFISH_API_URL` when the simulation server exists
- `MIROFISH_API_TOKEN` when the MiroFish gateway requires it
- `MIROFISH_MAX_ROUNDS=20`
- `LINK_STUDY_ALLOW_PII_EXPORT=false`

Health endpoint after deploy:

```text
https://YOUR-DOMAIN/api/health
```

MCP endpoint:

```text
https://YOUR-DOMAIN/mcp
```

## 3. MiroFish — separate service

Do not deploy MiroFish inside LINK STUDY or inside Vercel. Run official MiroFish on a long-lived VM/container host with its own LLM and Zep credentials.

For production, expose it through a private/authenticated gateway and set that URL/token in LINK STUDY.

## 4. First real test

1. Open LINK STUDY.
2. Create a root or client study.
3. Build the real context snapshot.
4. Confirm source counts and coverage.
5. Connect ChatGPT to `/mcp` and call `get_study_context`.
6. Save findings using explicit truth classes.
7. Only after MiroFish health is green, launch the first simulation.
