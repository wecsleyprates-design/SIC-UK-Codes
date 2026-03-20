import { OPENAI_MODEL_VERSION } from "#lib/aiEnrichment/constants";
import { createOpenAIWithLogging } from "#utils/loggerAttach";

class FakeHeaders {
    private map: Map<string, string>;
    constructor(init?: Record<string, string>) {
        this.map = new Map(Object.entries(init ?? {}));
    }
    get(name: string): string | null {
        const v = this.map.get(name.toLowerCase()) ?? this.map.get(name);
        return v ?? null;
    }
    set(name: string, value: string) {
        this.map.set(name.toLowerCase(), value);
    }
    toObject(): Record<string, string> {
        const o: Record<string, string> = {};
        for (const [k, v] of this.map.entries()) {
            o[k] = v;
        }
        return o;
    }
    entries() {
        return this.map.entries();
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    forEach(callback: (value: string, key: string) => void) {
        for (const [k, v] of this.map.entries()) {
            callback(v, k);
        }
    }
}

class FakeResponse {
    status: number;
    headers: FakeHeaders;
    ok: boolean;
    statusText: string;
    url: string;
    private _body: any;

    constructor(
        body: any,
        init: { status?: number; headers?: Record<string, string>; statusText?: string; url?: string } = {}
    ) {
        this.status = init.status ?? 200;
        this.ok = this.status >= 200 && this.status < 300;
        this.statusText = init.statusText ?? (this.ok ? "OK" : "Error");
        this.headers = new FakeHeaders(init.headers);
        this._body = body ?? "";
        this.url = init.url ?? "";
    }

  async json() {
    return typeof this._body === "string" ? JSON.parse(this._body) : this._body;
  }

  async text() {
    return typeof this._body === "string" ? this._body : JSON.stringify(this._body);
  }
    async arrayBuffer() {
        const txt = await this.text();
        const enc = new TextEncoder();
        return enc.encode(txt).buffer;
    }

    clone() {
        return new FakeResponse(this._body, {
            status: this.status,
            headers: this.headers.toObject(),
            statusText: this.statusText,
            url: this.url,
        });
    }
}

function makeChatCompletionPayload(content = "{}") {
    return {
        id: "chatcmpl_test_1",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: OPENAI_MODEL_VERSION,
        choices: [
            {
                index: 0,
                finish_reason: "stop",
                message: { role: "assistant", content }
            }
        ],
        usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
    };
}

describe("createOpenAIWithLogging", () => {
    let originalFetch: any;

    beforeAll(() => {
        originalFetch = (global as any).fetch;
    });

    afterAll(() => {
        (global as any).fetch = originalFetch;
    });

    function makeLoggerSpies() {
        const info = jest.fn();
        const error = jest.fn();
        const debug = jest.fn();
        return { info, error, debug };
    }

    function makeStubbedFetch(store: { lastBody?: string } = {}) {
        return async function fetchStub(input: any, init?: any) {
            const u =
                typeof input === "string"
                ? input
                : typeof input?.url === "string"
                ? input.url
                : String(input || "");

            store.lastBody = init?.body ? init.body.toString() : "";

            if (u.startsWith("https://api.openai.com/v1/chat/completions")) {
                return new FakeResponse(
                    JSON.stringify(makeChatCompletionPayload(JSON.stringify({ ok: true }))),
                    { status: 200, headers: { "content-type": "application/json" }, url: u }
                );
            }

            return new FakeResponse("Not found", {
                status: 404,
                headers: { "content-type": "text/plain" },
                url: u,
            });
        };
    }

    it("logs redacted preview but keeps request body intact", async () => {
        const logger = makeLoggerSpies();
        const store: { lastBody?: string } = {};
        (global as any).fetch = makeStubbedFetch(store);

        const client = createOpenAIWithLogging(
            { apiKey: "sk-test" } as any,
            logger,
            { redact: true, maxPreview: 5000 }
        );

        const promptSensitive = [
            "email: jane.doe@example.com",
            "phone: +1 (415) 555-1212",
            "Bearer abc.def.ghi",
            "jwt: xxxxx.yyyyy.zzzzz",
            "token=superSecret12345",
            "api_key=A1b2C3d4E5f6G7h8I9j0K1"
        ].join("\n");

        const res = await (client as any).chat.completions.create({
        model: OPENAI_MODEL_VERSION,
        messages: [{ role: "user", content: promptSensitive }],
            temperature: 0
        });

        expect(res).toBeTruthy();
        expect(logger.info).toHaveBeenCalled();

        const call = logger.info.mock.calls.find((c: any[]) => c[1] === "[OpenAI][prompt]");
        expect(call).toBeTruthy();
        const [meta] = call as any;
        expect(meta).toHaveProperty("messages_preview");
        const preview0 = meta.messages_preview[0];
        expect(preview0.role).toBe("user");
        expect(String(preview0.content || "")).toContain("***********");
        expect(String(store.lastBody || "")).toContain("jane.doe@example.com");
        expect(String(store.lastBody || "")).toContain("(415) 555-1212");
        expect(String(store.lastBody || "")).toContain("Bearer abc.def.ghi");
        expect(String(store.lastBody || "")).toContain("token=superSecret12345");
    });

    it("respects maxPreview truncation", async () => {
        const logger = makeLoggerSpies();
        const store: { lastBody?: string } = {};
        (global as any).fetch = makeStubbedFetch(store);

        const client = createOpenAIWithLogging(
            { apiKey: "sk-test" } as any,
            logger,
            { redact: false, maxPreview: 10 }
        );

        const longText = "ABCDEFGHIJKLmnopqrstuvwxyz012345";
        await (client as any).chat.completions.create({
            model: OPENAI_MODEL_VERSION,
            messages: [{ role: "user", content: longText }],
            temperature: 0
        });

        const call = logger.info.mock.calls.find((c: any[]) => c[1] === "[OpenAI][prompt]");
        const [meta] = call as any;
        const preview0 = meta.messages_preview[0];
        expect(preview0.truncated).toBe(true);
        expect(String(preview0.content).length).toBeLessThanOrEqual(10);
    });

    it("survives logger failures", async () => {
        const logger = {
            info: jest.fn(() => { throw new Error("logger failed"); }),
            error: jest.fn(),
            debug: jest.fn()
        };
        const store: { lastBody?: string } = {};
        (global as any).fetch = makeStubbedFetch(store);

        const client = createOpenAIWithLogging(
            { apiKey: "sk-test" } as any,
            logger,
            { redact: true }
        );

        const res = await (client as any).chat.completions.create({
            model: OPENAI_MODEL_VERSION,
            messages: [{ role: "user", content: "hello" }],
            temperature: 0
        });

        expect(res).toBeTruthy();
    });

    it("logs transport errors and rethrows", async () => {
        const logger = makeLoggerSpies();
        (global as any).fetch = jest.fn(async () => {
            throw new Error("ECONNRESET");
        });

        const client = createOpenAIWithLogging(
            { apiKey: "sk-test" } as any,
            logger,
            { redact: false }
        );

        await expect(
            (client as any).chat.completions.create({
                model: OPENAI_MODEL_VERSION,
                messages: [{ role: "user", content: "hello" }],
                temperature: 0
            })
        ).rejects.toThrow("Connection error.");

        const errorCall = logger.error.mock.calls.find((c: any[]) => c[1] === "[OpenAI][error]");
        expect(errorCall).toBeTruthy();
        const [meta] = errorCall as any;
        expect(String(meta.error || "")).toContain("ECONNRESET");
    });

    it("defaults to redact=true", async () => {
        const logger = makeLoggerSpies();
        const store: { lastBody?: string } = {};
        (global as any).fetch = makeStubbedFetch(store);

        const client = createOpenAIWithLogging(
            { apiKey: "sk-test" } as any,
            logger
        );

        const contentWithPII = "contact me at john.smith@example.com";
        await (client as any).chat.completions.create({
            model: OPENAI_MODEL_VERSION,
            messages: [{ role: "user", content: contentWithPII }],
            temperature: 0
        });

        expect(logger.info).toHaveBeenCalled();
        const call = logger.info.mock.calls.find((c: any[]) => c[1] === "[OpenAI][prompt]");
        const [meta] = call as any;
        const preview0 = meta.messages_preview[0];
        expect(String(preview0.content)).toContain("***********");
        expect(String(store.lastBody || "")).toContain("john.smith@example.com");
    });
});