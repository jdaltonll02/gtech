param([ValidateSet('up','down','migrate','seed','logs')][string]$Command = 'up')
$ErrorActionPreference = 'Stop'
switch ($Command) {
  'up' { docker compose up -d --build }
  'down' { docker compose down }
  'migrate' { docker compose run --rm api npm run db:migrate }
  'seed' { docker compose run --rm api npm run seed -- --users 300 }
  'logs' { docker compose logs -f api worker web }
}
