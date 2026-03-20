type AnyLogger = {
  info?: (...a: any[]) => void;
  error?: (...a: any[]) => void;
  debug?: (...a: any[]) => void;
};

function safeLog(logger: AnyLogger, level: keyof AnyLogger, ...args: any[]) {
  try {
    const fn = logger?.[level];
    if (!fn) {
		  return;
	  }

    if (typeof args[0] === "string") {
      const msg = args[0];
      const meta = args[1] && typeof args[1] === "object" ? args[1] : {};
      const extra = args.length > 2 ? args.slice(2) : undefined;
      const obj = extra ? { ...meta, extra } : meta;
      fn.call(logger, obj, msg);
      return;
    }
    fn.apply(logger, args);
  } catch {
    /* no-break */
  }
}

type RedactionConfig = {
  mask?: string;
  redactEmails?: boolean;
  redactPhones?: boolean;
  redactBearer?: boolean;
  redactJwtLike?: boolean;
  redactKvSecrets?: boolean;
  redactApiKeysLike?: boolean;
  hardTruncateAt?: number;
};

function defaultRedactionConfig(): Required<RedactionConfig> {
  return {
    mask: "***********",
    redactEmails: true,
    redactPhones: true,
    redactBearer: true,
    redactJwtLike: true,
    redactKvSecrets: true,
    redactApiKeysLike: true,
    hardTruncateAt: 20000,
  };
}

function redactSensitiveString(s: string, cfg: Required<RedactionConfig>): string {
  let out = s;

  // Hard truncate very long strings to avoid giant logs (defense-in-depth)
  if (cfg.hardTruncateAt && out.length > cfg.hardTruncateAt) {
    const keep = Math.floor(cfg.hardTruncateAt / 2);
    out = `${out.slice(0, keep)}...${cfg.mask}...(truncated ${out.length - cfg.hardTruncateAt} chars)...${out.slice(-keep)}`;
  }

  // Emails
  if (cfg.redactEmails) {
    out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, cfg.mask);
  }

  // US-like phones
  if (cfg.redactPhones) {
    out = out.replace(/\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, cfg.mask);
  }

  // Bearer tokens
  if (cfg.redactBearer) {
    out = out.replace(/\bBearer\s+[A-Za-z0-9._\-+/=]+/gi, `Bearer ${cfg.mask}`);
  }

  // JWT-like (xxx.yyy.zzz)
  if (cfg.redactJwtLike) {
    out = out.replace(/\b[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g, cfg.mask);
  }

  // key/value secrets in querystring or body-ish "key=xxx"
  if (cfg.redactKvSecrets) {
    out = out.replace(
      /\b(api[_-]?key|access[_-]?key|secret|token|password|pwd|pass|client[_-]?secret|refresh[_-]?token)\s*=\s*[^&\s]+/gi,
      (_m, k) => `${k}=${cfg.mask}`
    );
  }

  // API-key like (long random strings): hex/base64-ish >= 20 chars
  if (cfg.redactApiKeysLike) {
    out = out.replace(/\b[A-Za-z0-9+/_-]{20,}\b/g, (m) => {
      const hasMix = /[A-Za-z]/.test(m) && /[0-9]/.test(m);
      return hasMix ? cfg.mask : m;
    });
  }

  return out;
}

function redactValueDeep(value: any, cfg: Required<RedactionConfig>): any {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveString(value, cfg);
  }

  if (Array.isArray(value)) {
    return value.map((v) => redactValueDeep(v, cfg));
  }

  if (typeof value === "object") {
    const out: any = Array.isArray(value) ? [] : {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactValueDeep(v, cfg);
    }
    return out;
  }

  return value;
}
function buildOpenAILoggingFetch(
  logger: AnyLogger,
  maxPreview = 5000,
  opts?: {
    redact?: boolean;
    redactionConfig?: RedactionConfig;
  }
) {
  const OAI_HOST = "api.openai.com";

  const ALLOWLIST: Array<{ method: string; pathPrefix: string }> = [
    { method: "POST", pathPrefix: "/v1/chat/completions" },
    { method: "POST", pathPrefix: "/v1/beta/chat/completions" },
    { method: "POST", pathPrefix: "/v1/responses" }
  ];

  function isAllowed(url: URL, method: string) {
    if (url.hostname !== OAI_HOST) {
      return false;
    }
    
    return ALLOWLIST.some(
      a => a.method === method && url.pathname.startsWith(a.pathPrefix)
    );
  }

  function isLikelyPromptPayload(json: any, path: string) {
    if (Array.isArray(json?.messages)) {
      return true;
    }

    if ("/v1/responses" === path && json?.input != null) {
      return true;
    }

    return false;
  }

  const doRedact = !!opts?.redact;
  const redactCfg = { ...defaultRedactionConfig(), ...(opts?.redactionConfig || {}) };

  return async function loggingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let req: Request | null = null;

    try {
      req = new Request(input as any, init);
      const url = new URL(req.url);

      if (isAllowed(url, req.method)) {
        const ct = req.headers.get("content-type") || "";

        if (ct.includes("application/json")) {
          let meta: any = {
            method: req.method,
            url: url.toString(),
            path: url.pathname,
          };

          try {
            const raw = await req.clone().text();
            if (raw) {
              meta.req_size = raw.length;

              try {
                const json = JSON.parse(raw);

                if (isLikelyPromptPayload(json, url.pathname)) {
                  const messages = Array.isArray(json?.messages) ? json.messages : undefined;

                  let messagesPreview = messages?.map((m: any) => {
                    const rawContent =
                      typeof m?.content === "string"
                        ? m.content
                        : m?.content != null
                        ? JSON.stringify(m.content)
                        : undefined;

                    const prepared =
                      doRedact && rawContent != null
                        ? redactSensitiveString(rawContent, redactCfg)
                        : rawContent;

                    const truncated = !!prepared && prepared.length > maxPreview;

                    return {
                      role: m?.role,
                      content: prepared
                        ? truncated
                          ? prepared.slice(0, maxPreview)
                          : prepared
                        : undefined,
                      length: prepared?.length,
                      truncated,
                    };
                  });

                  let inputPreview: any = undefined;
                  if (url.pathname === "/v1/responses" && json?.input != null) {
                    const redactedInput = doRedact ? redactValueDeep(json.input, redactCfg) : json.input;

                    if (typeof redactedInput === "string") {
                      const truncated = redactedInput.length > maxPreview;
                      inputPreview = truncated ? redactedInput.slice(0, maxPreview) : redactedInput;
                    } else {
                      inputPreview = redactedInput;
                    }
                    
                    meta.input_preview = inputPreview;
                  }

                  meta.model = json?.model;
                  meta.temperature = json?.temperature;
                  meta.top_p = json?.top_p;
                  meta.messages_count = messages?.length;

                  if (messagesPreview) {
                    meta.messages_preview = messagesPreview;
                  }

                  safeLog(logger, "info", "[OpenAI][prompt]", meta);
                }
              } catch {
                /* no-break */
              }
            }
          } catch {
            /* no-break */
          }
        }
      }
    } catch {
      /* no-break */
    }

    let res: Response;
    try {
      res = await fetch(input as any, init as any);
    } catch (e) {
      try {
        const urlStr = req?.url ?? String(input);
        safeLog(logger, "error", "[OpenAI][error]", { url: urlStr, error: (e as any)?.message });
      } catch {
        /* no-break */
      }

      throw e;
    }

    return res;
  };
}

import OpenAI from "openai";

/**
 * Creates an instance of OpenAI with a custom fetch function that logs prompt requests automatically.
 *
 * @param config - The configuration object for the OpenAI constructor.
 * @param logger - The logger instance used to log OpenAI API requests and responses.
 * @param opts - Optional settings for logging and redaction.
 * @param opts.maxPreview - Maximum number of characters to preview in logs (default: 5000).
 * @param opts.redact - Whether to redact sensitive information in logs (default: true).
 * @param opts.redactionConfig - Configuration for redaction rules.
 * @returns An OpenAI instance with logging enabled for API calls.
 */
export function createOpenAIWithLogging(
  config: ConstructorParameters<typeof OpenAI>[0],
  logger: AnyLogger,
  opts?: {
    maxPreview?: number;
    redact?: boolean;
    redactionConfig?: RedactionConfig;
  }
) {
  const loggingFetch = buildOpenAILoggingFetch(
    logger,
    opts?.maxPreview ?? 5000,
    { 
      redact: opts?.redact ?? true,
      redactionConfig: opts?.redactionConfig 
    }
  );
  return new OpenAI({ ...config, fetch: loggingFetch });
}