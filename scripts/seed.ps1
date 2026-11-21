$ErrorActionPreference = 'Stop'
docker compose run --rm api npm run seed -- --users 300
