import type { APIRequest, APIRequestContext } from "playwright/test";

import { invariant } from "es-toolkit";

import type { E2eResource } from "./e2e-resource.js";

const ERROR_MESSAGE_UNDEFINED_API =
  "The HTTP API is undefined. Please ensure it is initialized properly";

type InitHttpApiClientInput = {
  baseUrl: string;
  request: APIRequest;
};

class HttpApiClient implements E2eResource<[InitHttpApiClientInput]> {
  #api: APIRequestContext | undefined;

  async init(input: InitHttpApiClientInput) {
    const { baseUrl, request } = input;
    this.#api = await request.newContext({ baseURL: baseUrl });
  }

  async cleanUp() {
    await this.#api?.dispose();
    this.#api = undefined;
  }

  get api() {
    invariant(this.#api !== undefined, ERROR_MESSAGE_UNDEFINED_API);
    return this.#api;
  }
}

export { HttpApiClient };
