import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PlatformLayout } from "@/features/platform/components/platform-layout";

export const Route = createFileRoute("/platform")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <PlatformLayout>
      <Outlet />
    </PlatformLayout>
  );
}
