
// ErrorResponse.ts
export class ErrorMatchResponse {
  source: string;
  details: string;

  constructor(source: string, details: string) {
    this.source = source;
    this.details = details;
  }

  toJSON() {
    return {
      errors: {
        error: [
          {
            source: this.source,
            details: this.details,
          },
        ],
      },
    };
  }
}

