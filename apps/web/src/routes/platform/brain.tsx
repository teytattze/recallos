import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/platform/brain")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_platform/graphs"!</div>;
}
