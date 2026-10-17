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
| `BALANCEIO_ADMIN_EMAIL` + `BALANCEIO_ADMIN_PASSWORD` | platform admin account | No admin is created (warning). Password: 12+ characters; setting only one of the two stops startup |
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

Every non-Production environment falls back to a fixed local key so `start-dev.bat` needs no
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

`.gitignore` covers `appsettings.Local.json`, `appsettings.*.local.json`,
`.env*` (except `.env.example`), `*.pem`, `*.pfx`, `secrets.json`.

There is no commit hook. The earlier `.githooks/pre-commit` was removed from
the repository; nothing in the repo prevents a secret from being staged. Run
Run secret scanning in CI or locally (for example `gitleaks`) before
relying on this.

---

## Rotation

Two JWT signing keys and (per the earlier note) an SMTP password were
committed in the past and remain in git history. Treat them as public.

| Secret | Repo can verify | Action |
|---|---|---|
| Old `Jwt:Key` values | Yes: `SecretsBootstrap` rejects their SHA-256 hashes in every environment | Set `BALANCEIO_JWT_KEY` to a fresh key. Existing tokens become invalid. |
| `SmtpSettings:Password` (`support@balanceio.id`) | No | Rotate at the mail provider; set `BALANCEIO_SMTP_PASSWORD`. |
| `AWS:AccessKey` / `SecretKey` | Empty in the repo | Set by environment. |
| Production DB password | Placeholder rejected by `SecretsBootstrap` | Set `BALANCEIO_DB_CONNECTION`. |

Whether rotation has actually happened on the production host is an
operator fact, not something this repository records.

### Rotating the JWT key

```powershell
$newKey = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
[Environment]::SetEnvironmentVariable("BALANCEIO_JWT_KEY", $newKey, "Machine")
```

Restart the service. `SecretsBootstrap` refuses to start in Production on a
missing, burned or sub-32-byte key.

### Maintenance endpoints

`RepairController` was removed. `POST /api/admin/system/reset-database` (refused in
Production) and `force-schema-fix` (PostgreSQL only, typed confirmation, one
transaction) remain under `SuperAdmin`; schema changes belong in migrations.
