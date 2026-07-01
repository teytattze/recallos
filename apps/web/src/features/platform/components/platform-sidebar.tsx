"use client";

import { Link } from "@tanstack/react-router";
import {
  BrainIcon,
  ChevronsUpDownIcon,
  HandCoinsIcon,
  InboxIcon,
  type LucideIcon,
  UserRoundPenIcon,
  WorkflowIcon,
} from "lucide-react";

import { Logo } from "@/components/extended-ui/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { config } from "@/config";

type NavigationItem = {
  title: string;
  href: string;
  Icon: LucideIcon;
};

function PlatformSidebar() {
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={(props) => (
                <Link to="/platform" {...props}>
                  <Logo className="fill-sidebar-accent-foreground size-5!" />
                  <span className="font-semibold">RecallOS</span>
                  <span className="text-muted-foreground ml-auto text-[8px] font-medium">
                    v.{config.app.version}
                  </span>
                </Link>
              )}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Personal</SidebarGroupLabel>
          <SidebarMenu>
            {getPersonalNavigationItems().map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={(props) => (
                    <Link to={item.href} {...props}>
                      <item.Icon />
                      <span>{item.title}</span>
                    </Link>
                  )}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {getPlatformNavigationItems().map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={(props) => (
                    <Link to={item.href} {...props}>
                      <item.Icon />
                      <span>{item.title}</span>
                    </Link>
                  )}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Support</SidebarGroupLabel>
          <SidebarMenu>
            {getSupportNavigationItems().map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={(props) => (
                    <Link to={item.href} {...props}>
                      <item.Icon />
                      <span>{item.title}</span>
                    </Link>
                  )}
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src="" alt="John Doe" />
                <AvatarFallback className="rounded-lg">JD</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left">
                <span className="truncate text-xs font-semibold">John Doe</span>
                <span className="truncate text-xs">john.doe@recallos.io</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function getPersonalNavigationItems() {
  return [
    { title: "Inbox", href: "/platform/inbox", Icon: InboxIcon },
  ] as const satisfies NavigationItem[];
}

function getPlatformNavigationItems() {
  return [
    {
      title: "Brain",
      href: "/platform/brain",
      Icon: BrainIcon,
    },
    {
      title: "Webhook Subscription",
      href: "/platform/webhook-subscription",
      Icon: WorkflowIcon,
    },
  ] as const satisfies NavigationItem[];
}

function getSupportNavigationItems() {
  return [
    { title: "Billing", href: "/platform/billing", Icon: HandCoinsIcon },
    {
      title: "Feedback",
      href: "/platform/feedback",
      Icon: UserRoundPenIcon,
    },
  ] as const satisfies NavigationItem[];
}

export { PlatformSidebar };
