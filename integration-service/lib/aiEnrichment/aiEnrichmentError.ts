export class AIEnrichmentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AIEnrichmentError";
	}
	toJSON() {
		return {
			message: this.message,
			name: this.name,
			stack: this.stack
		};
	}
}

export class AIEnrichmentDelayed extends AIEnrichmentError {
	constructor(message: string) {
		super(message);
		this.name = "AIEnrichmentDelayed";
	}
}
