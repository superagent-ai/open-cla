import type { TemplatesResponse } from "@superagent-cla/shared";

export type ActionResult<T = void> = {
  error: string | null;
  data?: T;
};

export type RepositoryActionResult = {
  error: string | null;
  patch?: Partial<Pick<TemplatesResponse, "settings" | "signingSettings">>;
};

export const emptyActionResult = <T = void>(): ActionResult<T> => ({
  error: null
});

export const emptyRepositoryActionResult = (): RepositoryActionResult => ({
  error: null
});
