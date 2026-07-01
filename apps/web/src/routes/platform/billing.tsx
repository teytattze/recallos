import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/platform/billing")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/platform/billing"!</div>;
}
