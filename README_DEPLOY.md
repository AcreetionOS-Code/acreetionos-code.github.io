Deployment steps for AIDEN Cloudflare Worker

Required GitHub repository secrets (Settings → Secrets → Actions):

- CLOUDFLARE_API_TOKEN: Personal token scoped to Workers (publish rights)
- CLOUDFLARE_ACCOUNT_ID: Cloudflare account ID for the Worker (used at publish time)
- OPENROUTER_API_KEY: Server-side OpenRouter API key (kept in GitHub Secrets)
- AI_TEST_API_KEY: (optional) OpenRouter key for CI ai-review step

Recommended token scopes for CLOUDFLARE_API_TOKEN:
- Account.Workers: Edit
- Account.Workers KV Namespace: Read (if using KV)
- Zone.Zone: Read (not always required)

Human note
-------------------------------------
This work was prepared by Natalie Spiva (spivanatalie64) and Darren Clift (cobra3282000)
for the AcreetionOS project. The GitHub Actions workflow publishes the AIDEN proxy Worker
after running a lightweight AI review. If you need help adding secrets or running the
history cleanup script (tools/remove-secrets.sh), ping us via the project channels or
open an issue on the repo.


How it works
- The GitHub Actions workflow runs an AI review (tests/ai-review.py) using AI_TEST_API_KEY.
- If the review passes, the worker publish job runs and calls wrangler to publish the Worker.
- The worker reads OPENROUTER_API_KEY from its environment (supplied at publish time) and proxies /api/chat to OpenRouter.

Security notes
- Do NOT commit any keys to the repository. Use GitHub Secrets and Cloudflare Workers secrets.
- Rotate keys immediately if they have been committed previously.
