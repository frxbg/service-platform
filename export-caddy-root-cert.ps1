Param(
    [string]$OutputPath = ".\caddy-local-root.crt"
)

docker compose cp https-proxy:/data/caddy/pki/authorities/local/root.crt $OutputPath

Write-Host "Exported Caddy local root certificate to $OutputPath"
