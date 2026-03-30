# HTTPS Setup

## Access URLs

- Web app: `https://PUBLIC_HOST`
- Mobile web app: `https://PUBLIC_HOST:3443`
- API: `https://PUBLIC_HOST:8443`

## Recommended `.env`

Create `.env` in the repository root with values similar to:

```env
PUBLIC_HOST=192.168.1.50
FRONTEND_BASE_URL=https://192.168.1.50
```

For local-only work you can keep:

```env
PUBLIC_HOST=localhost
FRONTEND_BASE_URL=https://localhost
```

## Start the stack

```bash
docker compose up -d --build
```

## Trust the local CA on another device

The HTTPS proxy uses Caddy local certificates. On phones and other computers you must trust the generated local root certificate once.

Copy the root certificate from Docker:

```bash
docker compose cp https-proxy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-root.crt
```

On Windows PowerShell you can also use:

```powershell
.\export-caddy-root-cert.ps1
```

Install `caddy-local-root.crt` on the target device and mark it as trusted.

Without trusting this certificate, browsers may still open the page, but camera APIs and other secure-context features can remain blocked.

## Notes

- Existing dev ports `3000`, `3001`, and `8000` remain available for debugging.
- For browser camera access on mobile devices, use the HTTPS URLs above instead of the plain HTTP ports.
