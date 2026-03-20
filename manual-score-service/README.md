# Setting up server

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

## OOM heap snapshots (Kubernetes)

On EKS, a sidecar uploads Node heap snapshots to S3 after OOM (or `SIGUSR2`). Object keys are:

`heap_dump/<service>/<pod>_v<version>_<timestamp>_<filename>.heapsnapshot`

- **Bucket** is set per environment in **manual-score-service-deploy** (`HEAP_DUMP_S3_BUCKET` on the `heapdump-uploader` container).
- **Service** segment defaults to `manual-score-service` (`HEAP_DUMP_SERVICE_NAME`).
- Ensure the pod’s AWS identity (IRSA) can `s3:PutObject` on that bucket. Remove any legacy `HEAP_DUMP_S3_BUCKET` / `HEAP_DUMP_S3_PREFIX` entries from Doppler if present—they are not used for uploads.
