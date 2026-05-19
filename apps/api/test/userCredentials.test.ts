import { describe, expect, it } from "vitest";
import { getConfig, resetConfigForTests } from "../src/config.js";
import {
  resolveDropboxApiKey,
  saveUserDropboxSignCredential
} from "../src/signing/userCredentials.js";

describe("user Dropbox credentials", () => {
  it("prefers a provided key over stored credentials", async () => {
    const db = {
      query: {
        userSigningProviderCredentials: {
          findFirst: async () => null
        }
      }
    };

    const key = await resolveDropboxApiKey(db as never, getConfig(), "100", "provided-key");
    expect(key).toBe("provided-key");
  });
});
