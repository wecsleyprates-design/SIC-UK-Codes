# Jobs API Module

This module essentially creates DB representations of BullQueue jobs as those are meant to be short-lived and are thus not auditable/traceable until after their retention period ends.

## What “jobs” are here

- **Job request** (`JobRequest`): A request to run work (e.g. bulk business import). Has a type (`JobType`), state, trigger (API vs file), and optional `customer_id` / `business_id`. One request can have many jobs.
- **Job** (`Job`): A single unit of work belonging to a request. Stored in `jobs.job` with state (e.g. CREATED → STARTED → SUCCESS/ERROR), encrypted metadata (PII), and timestamps. Jobs are created via the API, and execution is triggered via the API with a mode (`synchronous` or `asynchronous`).

Execution is wired by **job type**: `JOB_TYPE_HANDLER` in `index.ts` maps each `JobType` to handlers (e.g. `synchronous`, `asynchronous`). For example, “bulk business import” can run in-process (`synchronous`) or be enqueued to Bull and processed by a queue worker (`asynchronous`). In both cases the same **persistent** `Job` row is updated (state, history, etc.).

## How this differs from ephemeral workers

|              | **Jobs (this module)**                                                                    | **Ephemeral workers**                                                                        |
| ------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **What**     | Persistent records in PostgreSQL (`jobs.job`, `jobs.job_request`). API-managed lifecycle. | One-shot processes (e.g. `jobWorker.ts` or Kubernetes Jobs) that run a single task and exit. |
| **Storage**  | DB tables + optional Bull queue for async execution.                                      | Config via `JOB_CONFIG` env; status in Redis. No row in `jobs.job`.                          |
| **Use case** | Auditable, customer-scoped work with state and history; sync or async execution.          | CPU/memory-heavy or isolated work where you want a separate process per run.                 |
| **Registry** | `JOB_TYPE_HANDLER` in this module (`index.ts`).                                           | `src/jobs/handlers` + `jobHandlers` in `src/workers/jobWorker.ts`.                           |

So: **jobs** in this module are the durable, API-first work records; **ephemeral workers** are a separate pattern for short-lived, process-per-task execution without a corresponding row in `jobs.job`. Bull queue workers (including sandboxed workers in `src/workers/sandboxed/`) are what consume **asynchronous** execution from this module—they process the same persistent jobs that were enqueued via the jobs API.
