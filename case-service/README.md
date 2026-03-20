# Setting up server (Requires Node 24.x LTS)

```bash
# Run all required dependencies: postgres
make up

# Setup env
cp .env.example .env.local
cp .env.example .env
- Set right values environment values in both files. As a practice, we use .env.local for local environment and .env for production environment.

# Keys
Add necessary keys under keys directory

# Create database schema using migrations
npm run migrate:up

# Start dev server
npm run dev
```

## Docker commands

```bash
# Kill all containers
make down
# Reset all docker data and start afresh
make reset
```

Refer `Makefile` for other commands.

## Making commits

We leverage [commitzen](https://www.npmjs.com/package/git-cz) to make clean and meaningful commits.

To make a commit once changes are done:

```bash
# Stage all your changes
git add .

#run commit with commitzen
npm run commit
```

## Create or run SQL migration scripts

```bash

# Add your database configuration to the .env file. The migration commands will not retrieve database configuration settings from other environment files.

# Create mirgration script
npm run migrate:create <migration-name>

# Spin up all sql migrations: migrate up
npm run migrate:up

# NOTE: migrate-up might not work if you have a dirty database, to reset it, run:
npm run migrate:reset
```

Refer `package.json` for more npm scripts

## Unit Testing

we use [jest](https://jestjs.io/docs/getting-started) for testing the code.

Refer the link for more comprehensive details.

Install jest globally so that it can be used across other services too

```bash
npm i jest -g
```

```bash
# Run all tests
npm run test

# Run all tests with coverage
npm run test:coverage

# Run specific test file
jest -- <name-of-file>

# Pull LaunchDarkly feature flags to local feature_flags.json file
# Whenever you want to test feature flags on local you can make tweaks in local feature_flags.json and test your file
make feature-flags LD_SDK_KEY=LaunchDarkly-SDK-Key-here
```

## Cron jobs

Cron jobs run as **Kubernetes CronJobs**, not inside the API process. The API does not start or schedule any crons.

- **Job logic** lives in `src/cron/jobs/` (e.g. `applicant-reminder`, `business-score-refresh`, `case-status-update`, `monthly-onboarding-limit-reset`). Each file exports an async handler.
- **Kubernetes** runs the same Docker image on a schedule and executes one job per run via `npm run run-cron`, with `CRON_JOB_NAME` set to the job name (e.g. `applicant-reminder`).
- **Entrypoint** is `src/cron/run-cron.ts`: it reads `CRON_JOB_NAME`, calls the matching handler, then exits.

Schedules and deployment manifests (CronJob specs, env, resources) are in the **case-service-deploy** repo under `base/cronjobs/` and per-env overlays.

