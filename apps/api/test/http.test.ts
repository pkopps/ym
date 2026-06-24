import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { IncomingMessage } from "node:http";
import { parseRequest } from "../src/http";

function createRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}): IncomingMessage {
  const stream = Readable.from([options.body ?? ""]) as IncomingMessage;
  stream.method = options.method ?? "POST";
  stream.url = options.url ?? "/";
  stream.headers = options.headers ?? {};
  return stream;
}

test("parseRequest supports application/x-www-form-urlencoded bodies", async () => {
  const request = createRequest({
    url: "/api/launch/inbound/email",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: "from=Sam%20Homeowner%20%3Csam%40example.com%3E&reply_to=sam.reply%40example.com&message-id=%3Cmsg_123%40example.com%3E&text=Need%20weekly%20mowing"
  });

  const context = await parseRequest(request);
  assert.equal(context.path, "/api/launch/inbound/email");
  assert.deepEqual(context.body, {
    from: "Sam Homeowner <sam@example.com>",
    reply_to: "sam.reply@example.com",
    "message-id": "<msg_123@example.com>",
    text: "Need weekly mowing"
  });
});

test("parseRequest returns a 400-style HttpError for malformed JSON bodies", async () => {
  const request = createRequest({
    url: "/api/support/tickets",
    headers: {
      "content-type": "application/json"
    },
    body: "{\"broken\":"
  });

  await assert.rejects(
    () => parseRequest(request),
    (error: Error & { statusCode?: number }) =>
      error.statusCode === 400 && /Malformed JSON request body/i.test(error.message)
  );
});
