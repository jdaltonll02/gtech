.PHONY: up down migrate seed test-server lint-server test-web test-app
up:
	docker compose up -d --build
down:
	docker compose down
migrate:
	docker compose run --rm api npm run db:migrate
seed:
	docker compose run --rm api npm run seed -- --users 300
test-server:
	docker compose run --rm api npm test
lint-server:
	docker compose run --rm api npm run lint && docker compose run --rm api npm run build
test-web:
	cd web && npm test && npm run lint && npm run build
test-app:
	cd app && flutter analyze && flutter test
