import type { PropsWithChildren } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PlatformSidebar } from "@/features/platform/components/platform-sidebar";

function PlatformLayout(props: PropsWithChildren) {
  const { children } = props;
  return (
    <SidebarProvider className="h-full">
      <PlatformSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}

export { PlatformLayout };
