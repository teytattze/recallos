import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/platform/inbox")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/platform/inbox"!</div>;
}
