import type { EmptyObject, JsonObject } from "type-fest";

type DomainEvent<
  TEventName extends string = string,
  TPayload extends JsonObject = EmptyObject,
> = Readonly<
  TPayload & {
    eventName: TEventName;
    aggregateId: string;
    createdAt: Date;
  }
>;

function defineEvent<TEventName extends string>(
  eventName: TEventName,
): <TPayload extends JsonObject = EmptyObject>(
  aggregateId: string,
  createdAt: Date,
  payload?: TPayload,
) => DomainEvent<TEventName, TPayload> {
  return function eventFactory<TPayload extends JsonObject = EmptyObject>(
    aggregateId: string,
    createdAt: Date,
    payload?: TPayload,
  ): DomainEvent<TEventName, TPayload> {
    return {
      ...payload,
      eventName,
      aggregateId,
      createdAt,
    } as DomainEvent<TEventName, TPayload>;
  };
}

export { defineEvent };
export type { DomainEvent };
