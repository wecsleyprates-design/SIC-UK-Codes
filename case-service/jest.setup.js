// Prevent Bull queues from attempting Redis connections during unit tests.
// This eliminates noisy "🐂⚠️ Bull queue error" logs (e.g. invitation-status) when Redis isn't available.
jest.mock("bull", () => {
	// Bull is imported as the default export in `src/helpers/bullQueue.ts`:
	//   import Queue from "bull";
	// and used as: new Queue(queueName, options)
	return function MockBullQueue() {
		return {
			name: "mock-bull-queue",
			on: jest.fn(),
			add: jest.fn(),
			addBulk: jest.fn(),
			getJob: jest.fn(),
			removeRepeatable: jest.fn(),
			removeRepeatableByKey: jest.fn(),
			pause: jest.fn(),
			resume: jest.fn()
		};
	};
});
