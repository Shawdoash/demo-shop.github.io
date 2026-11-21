# Demo Shop

This project includes a storefront and a Node.js server for its demo APIs and admin console. GitHub stores the source code; it does not run `server.js`. Deploy the project to a Node.js host that provides HTTPS for public traffic (many providers issue and renew TLS certificates automatically).

## Try Online 
Url - https://demo-shop-ea75.onrender.com/

## Run locally

```powershell
$env:ADMIN_USERNAME = "your-local-admin-name"
$env:ADMIN_PASSWORD = "choose-a-local-password"
npm start
```

Open `http://localhost:43127`. The admin console is at `/admin`. Local development uses HTTP; do not use local credentials in a public deployment.

## Deploy

1. Push the project to a GitHub repository.
2. Create a Node.js web service with the repository as its source and `npm start` as its start command.
3. Configure `ADMIN_USERNAME` and `ADMIN_PASSWORD` as secret environment variables in the hosting provider. Do not commit credentials.
4. Enable the provider's HTTPS/TLS and HTTP-to-HTTPS redirect for the public service URL. The provider terminates TLS and forwards requests to this Node server; the app's API calls use same-origin relative paths.
5. Set `NODE_ENV` to `production`. The admin session cookie will then include the `Secure` attribute and only be sent over HTTPS.

Admin login remains disabled until both admin environment variables are set.

## Deploy on Render

1. Create a GitHub repository and push this project.
2. In Render, choose **New > Blueprint** and connect the repository. Render detects `render.yaml`.
3. Render will ask for `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Set both as strong secret values.
4. Deploy the web service. Render provides a public `*.onrender.com` URL and manages HTTPS automatically.
5. Open `/admin` on the deployed URL and sign in with the Render environment values.

No GitHub Actions or GitHub Pages server is used for this deployment. GitHub stores the source; Render runs the Node process continuously.

The free Render plan may sleep and may have ephemeral disk storage. For an always-on demo or to retain uploaded catalog/submission changes, use a paid Render plan and add a persistent disk mounted at `server-data`. Keep `ADMIN_PASSWORD` only in Render's secret environment settings, never in GitHub.
