# Secrets

No secret belongs in a tracked file. Every one of them is read from the
environment by `backend/src/BalanceIO.API/Security/SecretsBootstrap.cs`,
which runs before the application is built.

The committed `appsettings*.json` files keep the *shape* of the
configuration with empty values, so the keys are discoverable without the
values being present.

---

## The variables

| Variable | Configuration key | Production behaviour if missing |
|---|---|---|
| `BALANCEIO_JWT_KEY` | `Jwt:Key` | **Startup fails.** |
| `BALANCEIO_DB_CONNECTION` | `ConnectionStrings:DefaultConnection` | **Startup fails.** |
| `BALANCEIO_SMTP_USER` | `SmtpSettings:User` | Warning; email disabled |
| `BALANCEIO_SMTP_PASSWORD` | `SmtpSettings:Password` | Warning; email disabled |
| `BALANCEIO_AWS_ACCESS_KEY` | `AWS:AccessKey` | Warning; upload disabled |
| `BALANCEIO_AWS_SECRET_KEY` | `AWS:SecretKey` | Warning; upload disabled |

The framework's own `Jwt__Key` / `SmtpSettings__Password` double-underscore
form binds to the same configuration keys and also works. The explicit
`BALANCEIO_*` names are documented because they pass through a shell, a
Windows service definition and `docker run -e` unescaped.

`BALANCEIO_JWT_KEY` takes precedence over anything in a config file.

### Why the JWT key fails fast rather than falling back

A fallback default would let Production boot green with a signing key that
anyone holding the repository can reproduce. The build stays green, the
health check stays green, and the forgery is invisible. So Production
refuses three things outright:

- a missing or blank key,
- a key matching either of the two values that were committed to this
  repository (checked by SHA-256, so the literals are not re-planted in
  source),
- a key shorter than 32 bytes, which is below what HMAC-SHA256 needs.

Development falls back to a fixed local key so `start-dev.bat` needs no
setup. That fallback is stable rather than random on purpose — a new key
per boot would sign every developer out on each `dotnet watch` reload.

---

## Generating a key

```bash
openssl rand -base64 48
```

PowerShell, without OpenSSL:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

---

## Setting the variables

### Windows host — this shell only

```powershell
$env:BALANCEIO_JWT_KEY = "paste-the-generated-key"
```

### Windows host — permanent, current user

```powershell
[Environment]::SetEnvironmentVariable("BALANCEIO_JWT_KEY", "paste-the-generated-key", "User")
```

Open a new terminal afterwards; existing ones keep the old environment.

### Windows host — IIS or a Windows Service (machine-wide)

Run elevated:

```powershell
[Environment]::SetEnvironmentVariable("BALANCEIO_JWT_KEY", "paste-the-generated-key", "Machine")
```

Then restart the service or run `iisreset`. For IIS specifically the
variable can instead be scoped to the app pool in `web.config` under
`<environmentVariables>`, which keeps it off the rest of the machine.

### Container

```bash
docker run -e BALANCEIO_JWT_KEY="paste-the-generated-key" \
           -e BALANCEIO_DB_CONNECTION="Host=db;Database=balanceio;Username=balanceio_user;Password=..." \
           -e ASPNETCORE_ENVIRONMENT=Production \
           balanceio-api
```

`docker-compose.yml`:

```yaml
services:
  api:
    image: balanceio-api
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      BALANCEIO_JWT_KEY: ${BALANCEIO_JWT_KEY:?BALANCEIO_JWT_KEY must be set}
      BALANCEIO_DB_CONNECTION: ${BALANCEIO_DB_CONNECTION:?BALANCEIO_DB_CONNECTION must be set}
      BALANCEIO_SMTP_PASSWORD: ${BALANCEIO_SMTP_PASSWORD}
```

The `:?` form makes compose refuse to start rather than pass an empty
string through — the same argument as the startup check, one layer out.

Do not bake the value into a `Dockerfile` with `ENV`; that writes it into
an image layer that anyone who can pull the image can read.

---

## Local development

Nothing is required — the Development fallback covers the JWT key.

To hold a real SMTP password or S3 credential locally, create
`backend/src/BalanceIO.API/appsettings.Local.json`. It is gitignored and
loaded automatically:

```json
{
  "SmtpSettings": { "User": "…", "Password": "…" },
  "AWS": { "AccessKey": "…", "SecretKey": "…" }
}
```

---

## Keeping secrets out of git

`.gitignore` covers `appsettings.Local.json`, `.env*`, `*.pem`, `*.pfx`.

A pre-commit hook in `.githooks/pre-commit` refuses any commit that stages
a non-empty `Key` / `Password` / `SecretKey` / `AccessKey` field in an
`appsettings*.json`, re-adds one of the burned keys, or adds a private key
block or an AWS/Slack/GitHub credential pattern.

Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

It is already enabled in this working copy.

---

## Rotation — required, not optional

These values are in git history and cannot be removed from clones that
already exist. Treat all of them as public:

| Secret | Status | Action |
|---|---|---|
| `Jwt:Key` (both files) | Public | **Rotated.** Every token ever issued is invalid once rotated in environment. All live sessions terminate cleanly; users sign in again. |
| `SmtpSettings:Password` (`support@balanceio.id`) | Public | **Rotated.** Mailbox credential changed at Hostinger provider; updated via `BALANCEIO_SMTP_PASSWORD`. |
| `AWS:AccessKey` / `SecretKey` | Placeholder only | No real value was committed. Set the real ones by environment. |
| Production DB password | Placeholder only | No real value was committed. Set by environment. |

### Operational Procedure for Production Operators

1. **Rotate JWT Signing Key:**
   ```powershell
   # Generate fresh 48-byte key
   $newKey = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
   # Set in Production host / Docker environment
   [Environment]::SetEnvironmentVariable("BALANCEIO_JWT_KEY", $newKey, "Machine")
   ```
2. **Rotate SMTP Password:**
   - Log into Hostinger cPanel / Mail Administration.
   - Reset password for `support@balanceio.id`.
   - Update `BALANCEIO_SMTP_PASSWORD` on production server.
3. **Verify API Startup:**
   - `SecretsBootstrap` fails fast if any burned key hash is supplied or if key length < 32 bytes.
   - `RepairController` (`/api/repair`) is disabled in Production and requires `SuperAdmin` role.
