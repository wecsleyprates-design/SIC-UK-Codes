# Scaling Celery Workers for Similarity Matching

## The Problem We're Solving

Your matching service queries Redshift for candidate businesses and scores them for similarity. The challenge is that **you never know how many candidates you'll get** - it could be 30,000 or it could be 5 million. Each candidate uses about 80KB of memory, so a 250k candidate match needs ~22GB of RAM.

Right now, everything runs through one queue with 32GB workers. When a massive match job hits, it either crashes the worker or blocks all your other tasks. You need a system that can handle any size match without artificial limits.

## Current Setup

**What you have:**
- Single Celery queue for all task types (matching, firmographics, exports)
- Workers configured with `--pool=solo -c 1` (single-threaded, one task at a time)
- 32GB memory per worker
- Redis as the broker
- Tasks must stay single-threaded (XGBoost model isn't thread-safe)

**Why it's breaking:**
- Memory usage formula: `Base (2GB) + (Candidates × 80KB)`
- Examples:
  - 30k candidates = 4.5GB ✅ Fits easily
  - 100k candidates = 10GB ✅ Still fine
  - 250k candidates = 22GB ⚠️ Getting tight
  - 500k candidates = 42GB ❌ Doesn't fit
  - 1M+ candidates = 80GB+ ❌ Way too big

## Solution Overview: Multiple Worker Sizes

Instead of one worker size trying to handle everything, you run different sized workers for different sized jobs. Think of it like shipping packages - you don't use the same truck for envelopes and furniture.

**The approach:**
1. **Separate matching from other tasks** - Stop letting small firmographics tasks wait behind giant matching jobs
2. **Create size-based queues** - Route jobs to different queues based on expected memory needs
3. **Deploy different worker sizes** - Run workers sized appropriately for each queue
4. **Scale independently** - Add more workers where you need capacity

## Step 1: Isolate Matching Tasks

**What to do:**
Create a dedicated `matching_queue` separate from your default queue. This alone solves a lot of problems because matching jobs stop blocking everything else.

**How workers are assigned:**
- `matching_queue` → 4 workers with 32GB each (handles most matches)
- `default_queue` → 2 workers with 8GB each (firmographics, exports, etc.)

**What this gives you:**
- Matching jobs no longer starve firmographics tasks
- Smaller tasks finish faster
- Better resource utilization
- Easier to monitor which queue has problems

**Tradeoffs:**
- Simple to implement (just change task routing)
- Still limited to 32GB per match
- Doesn't solve the unlimited candidate problem yet
- But it's a huge immediate improvement

## Step 2: Size-Based Routing

**What to do:**
Before running a match, estimate how many candidates it'll find. Then route it to the right sized queue.

**Queue structure:**
- `matching_small` → Jobs with <50k candidates → 8GB workers
- `matching_medium` → Jobs with 50-150k candidates → 16GB workers
- `matching_large` → Jobs with 150-380k candidates → 32GB workers
- `matching_xlarge` → Jobs with >380k candidates → 64GB+ workers

**How to estimate candidate count:**
Run a fast `COUNT(*)` query on Redshift with the same filters before the actual match. This takes milliseconds and tells you which queue to use.

**What this gives you:**
- Small jobs finish on small workers (faster, cheaper)
- Big jobs get big workers (don't crash)
- Can handle truly massive matches (no upper limit)
- Cost-effective (don't waste 64GB on a 30k candidate job)

**Tradeoffs:**
- Requires estimation query (adds ~100-200ms)
- More complex routing logic
- Need to maintain multiple worker pools
- But you can now handle unlimited candidates

## Step 3: Mix Worker Sizes (Recommended)

**What to do:**
Instead of all workers being the same size, deploy a mix based on your actual workload distribution.

**Example distribution if 70% of matches are <100k candidates:**
- 6× 8GB workers for small matches (frequent)
- 4× 16GB workers for medium matches (common)
- 2× 32GB workers for large matches (occasional)
- 1× 64GB worker for huge matches (rare)

**How to figure out your mix:**
Look at your historical data. What percentage of matches have:
- <50k candidates?
- 50-150k candidates?
- 150-380k candidates?
- >380k candidates?

Deploy more workers for the sizes you see most often.

**What this gives you:**
- Optimal cost (right-sized workers)
- Better throughput (more parallelism for common cases)
- Still handles edge cases (huge matches)

**Tradeoffs:**
- Most complex to set up
- Need to monitor and adjust over time
- But it's the most efficient long-term solution

## Step 4: Auto-Scaling (Optional)

**What to do:**
Automatically add/remove workers based on how backed up your queues get.

**Simple rule:**
If a queue has >10 tasks waiting for >5 minutes, add another worker. If queue is empty for >20 minutes, remove a worker.

**Where this helps most:**
- Handling sudden spikes (big customer imports lots of data)
- Night batch processing vs. daytime interactive queries
- Cost savings (scale down when idle)

**Tradeoffs:**
- Workers take 1-2 minutes to start
- Not instant response
- But smooths out variable load automatically

## Deployment Options

### Option A: Enhanced Docker Compose (Easiest)

Stay with Docker Compose but add multiple worker services.

**What you'd have in docker-compose.yaml:**
- `warehouse-worker-small` (8GB, 6 containers)
- `warehouse-worker-medium` (16GB, 4 containers)
- `warehouse-worker-large` (32GB, 2 containers)
- `warehouse-worker-xlarge` (64GB, 1 container)

**Pros:**
- Minimal changes to existing setup
- Simple to understand and debug
- Good for single-machine deployment

**Cons:**
- Manual scaling only
- All workers on one host (less resilient)
- Limited by host machine size

### Option B: AWS ECS Fargate (Most Scalable)

Run workers as ECS tasks with different memory configurations.

**What you'd configure:**
- Task definition per worker size (8GB, 16GB, 32GB, 64GB)
- Service per queue that maintains desired count
- Auto-scaling based on CloudWatch metrics

**Pros:**
- True serverless (AWS manages hosts)
- Auto-scaling built-in
- Each worker isolated
- Only pay for what you use

**Cons:**
- More expensive per hour
- AWS-specific knowledge needed
- Takes 30-60s to scale up

### Option C: EC2 Auto Scaling Groups (Most Cost-Effective)

Traditional VMs that scale in/out based on load.

**What you'd configure:**
- Launch template per worker size
- Auto Scaling Group per queue
- Scale on CloudWatch alarms (queue depth)

**Pros:**
- Cheapest option (EC2 spot instances)
- Full control over host configuration
- Faster scaling than Fargate

**Cons:**
- More infrastructure to manage
- Need to handle host failures
- Requires more DevOps expertise

## Implementation Roadmap

### Phase 1: Immediate Relief (Week 1-2)

**What to do:**
- Create `matching_queue` separate from default
- Deploy 4× 32GB workers for matching
- Keep 2× 8GB workers for everything else

**Expected outcome:**
- Firmographics stop getting blocked
- Easier to monitor matching performance
- No more "everything is stuck" incidents

**Effort:** Low | **Risk:** Low | **Impact:** High

### Phase 2: Right-Sizing (Month 1)

**What to do:**
- Analyze your historical match sizes
- Implement candidate count estimation
- Create size-based routing (small/medium/large/xlarge)
- Deploy mixed worker pool

**Expected outcome:**
- Small matches finish 3-4x faster
- Can handle matches >380k candidates
- 30-40% cost savings from right-sizing

**Effort:** Medium | **Risk:** Medium | **Impact:** Very High

### Phase 3: Auto-Scaling (Month 2-3)

**What to do:**
- Set up CloudWatch metrics for queue depth
- Configure auto-scaling policies
- Test scaling behavior under load

**Expected outcome:**
- Automatic capacity adjustment
- Handle traffic spikes gracefully
- Further cost optimization

**Effort:** Medium | **Risk:** Medium | **Impact:** Medium

## Monitoring & Alerts

**Key metrics to track:**

**Per Queue:**
- Tasks waiting (if >20, need more workers)
- Average wait time (target <2 minutes)
- Task failures (watch for OOM errors)

**Per Worker:**
- Memory usage (if consistently >90%, worker too small)
- CPU usage (should be 80-100% when running, single-threaded is expected)
- Task completion rate

**Overall:**
- Match size distribution (helps optimize worker mix)
- Cost per match by size tier
- End-to-end match latency

## Key Decisions to Make

1. **What's your current match size distribution?**
   - Run analytics on past matches to see actual candidate counts
   - This determines your optimal worker mix

2. **What's your latency tolerance?**
   - Interactive (user waiting): Need fast small workers
   - Batch processing: Can use fewer larger workers

3. **What's your infrastructure preference?**
   - Keep it simple: Enhanced Docker Compose
   - AWS native: ECS Fargate
   - Cost-conscious: EC2 Auto Scaling Groups

4. **What's your budget for scaling?**
   - Tight: Start with Phase 1 only
   - Moderate: Go straight to Phase 2
   - Flexible: Implement all three phases

## Quick Wins You Can Do Today

1. **Profile your matches** - Query your database for candidate count distribution
2. **Add memory logging** - Track actual memory usage per match in your tasks
3. **Separate the queue** - Create matching_queue (Phase 1) - takes a few hours
4. **Set up alerts** - Get notified when queues back up or workers OOM

## The Bottom Line

You don't need a complete rewrite. Start by separating matching into its own queue with dedicated workers (Phase 1). Then, once you understand your workload distribution, implement size-based routing (Phase 2). This approach lets you handle unlimited candidate sizes while keeping costs reasonable.

The key insight: **Right-sized workers for right-sized jobs.** Stop trying to make one worker size handle everything.
