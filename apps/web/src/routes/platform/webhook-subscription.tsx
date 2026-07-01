import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/platform/webhook-subscription")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/platform/webhook-subscriptions"!</div>;
}
