import type { ComponentProps, PropsWithChildren } from "react";

import { cn } from "@/libs/ui/utils";

function Center({
  children,
  className,
}: PropsWithChildren<ComponentProps<"div">>) {
  return (
    <div className={cn("grid h-full w-full place-content-center", className)}>
      {children}
    </div>
  );
}

export { Center };
