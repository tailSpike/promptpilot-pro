# Bruno examples

This folder contains importable examples for Bruno (the open-source API client):

- Collection: `bruno/promptpilot-triggers/`
- Environment: `bruno/promptpilot-triggers/environments/local.bru`

How to use:

1. Install Bruno: https://www.usebruno.com/
2. In Bruno, open the collection by choosing File > Open Collection and selecting the `bruno/promptpilot-triggers` folder.
3. Select the `local` environment and set variables:
   - `baseUrl` (e.g., http://127.0.0.1:3001)
   - `jwt` (your user token)
   - `manualTriggerId`, `apiTriggerId`, `apiKey`, `webhookTriggerId`, `webhookSecret`
4. Run any request:
   - Manual Execute (Bearer auth)
   - API Invoke (X-API-Key)
   - Webhook Invoke (X-Webhook-Secret)
   - Dispatch Event (Bearer auth)

Tip: You can duplicate the environment for different servers or users.
