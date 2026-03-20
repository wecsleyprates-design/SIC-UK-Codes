TAG_NAME=score-service
VERSION=$(shell git rev-parse --short HEAD)
IMAGE_TAG=$(TAG_NAME):$(VERSION)
IMAGE_TAG_LATEST=$(TAG_NAME):latest
DOCKER_USERNAME=username-here
USER="$(shell id -u):$(shell id -g)"
COMPOSE_RUN=docker-compose run --rm --user=$(USER)
COMPOSE_EXEC=docker exec -it
LD_SDK_KEY=launchdarkly-sdk-key-here

start: build up logs
workdir:
	$(COMPOSE_EXEC) api sh

npm-install:
	$(COMPOSE_EXEC) api npm install

migrate-create:
	db-migrate create ${MIGRATION_NAME} -m ./db/migrations/migrate

migrate-up:
	$(COMPOSE_EXEC) api npm run migrate:up

migrate-down:
	$(COMPOSE_EXEC) api npm run migrate:down

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

reset:
	docker-compose down
	rm -R -- ./.data/docker/*/
logs:
	docker logs -f api

down-v:
	docker-compose down -v

reset: down-v

test:
	docker-compose -f docker-compose.test.yml run --no-deps test npm run test:coverage

lint:
	$(COMPOSE_RUN) --no-deps --entrypoint='' api npm run lint

lint-fix:
	$(COMPOSE_RUN) --no-deps --entrypoint='' api npm run lint:fix

docker-build:
	docker build . -f prod.Dockerfile -t $(IMAGE_TAG)

docker-login:
	cat docker_password.txt | docker login --username $(DOCKER_USERNAME) --password-stdin

docker-login-ci:
	docker login --username $(DOCKER_USERNAME) --password $(DOCKER_PASSWORD)

docker-tag-latest:
	docker tag $(IMAGE_TAG) $(IMAGE_TAG_LATEST)

docker-push:
	docker push $(IMAGE_TAG)

docker-push-latest:
	docker push $(IMAGE_TAG_LATEST)

docker-run-image:
	docker run -it --rm $(IMAGE_TAG) sh

docker-release: docker-build docker-push
docker-release-latest: docker-release docker-tag-latest docker-push-latest

show_local_development_url:
	node -r dotenv/config ./subdomain.js --full-url

feature-flags: ## Updates the LaunchDarkly feature flags file to contain all the latest flags and values. Usage; [ARGS]
	@if [ -z "$(LD_SDK_KEY)" ]; then \
		echo "LD_SDK_KEY argument required. Usage: make feature-flags LD_SDK_KEY=<LaunchDarkly SDK Key>"; \
		exit 1; \
	fi
	@echo "Updating feature flags..."
	curl -k -H "Authorization: $(LD_SDK_KEY)" https://app.launchdarkly.com/sdk/latest-all >feature_flags.json