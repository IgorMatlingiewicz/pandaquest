import { HttpError, failureKey } from "@/lib/http-error";

// Enough of a fetch Response for HttpError.from.
const response = (status: number, json: () => Promise<unknown>) =>
  ({ status, json }) as unknown as Response;

describe("HttpError.from", () => {
  it("keeps the code and availableAt of a friends refusal", async () => {
    const error = await HttpError.from(
      response(409, async () => ({
        statusCode: 409,
        error: "Conflict",
        code: "FRIEND_REQUEST_COOLDOWN",
        message: "Ponowne zaproszenie będzie możliwe później",
        availableAt: "2026-11-21T12:00:00.000Z",
      })),
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(409);
    expect(error.code).toBe("FRIEND_REQUEST_COOLDOWN");
    expect(error.availableAt).toBe("2026-11-21T12:00:00.000Z");
  });

  it("leaves the code out for the modules that send none", async () => {
    const error = await HttpError.from(
      response(404, async () => ({ statusCode: 404, message: "Not Found" })),
    );

    expect(error.status).toBe(404);
    expect(error.code).toBeUndefined();
    expect(error.availableAt).toBeUndefined();
  });

  it("keeps the status when the body is not JSON", async () => {
    const error = await HttpError.from(
      response(502, async () => {
        throw new SyntaxError("Unexpected token <");
      }),
    );

    expect(error.status).toBe(502);
    expect(error.code).toBeUndefined();
  });

  it.each([
    ["a code that is not text", { code: 42 }],
    ["a body that is no object", "Too Many Requests"],
    ["no body", null],
  ])("ignores %s", async (_, body) => {
    const error = await HttpError.from(response(429, async () => body));

    expect(error.status).toBe(429);
    expect(error.code).toBeUndefined();
  });
});

describe("failureKey", () => {
  it("still decides by the status alone, as before", () => {
    expect(
      failureKey(new HttpError(409, { code: "X" }), (s) => `status.${s}`),
    ).toBe("status.409");
    expect(failureKey(new TypeError("offline"))).toBe("common.noConnection");
  });
});
