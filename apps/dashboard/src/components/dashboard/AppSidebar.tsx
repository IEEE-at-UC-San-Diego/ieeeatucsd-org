import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OfficerAiChat } from "@/components/dashboard/shared/OfficerAiChat";
import { UserAvatarFallback } from "@/components/dashboard/UserAvatarFallback";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  navigationCategories,
  NAVIGATION_PATHS,
  type NavigationCategory,
} from "@/config/navigation";

interface AppSidebarProps {
  currentPath?: string;
}

export function AppSidebar({ currentPath = "" }: AppSidebarProps) {
  const { user, userRole, isLoading, signOut } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(navigationCategories.map((cat) => cat.title)),
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const isActiveRoute = (href: string): boolean => {
    if (currentPath === "/" || currentPath === "") {
      return href === NAVIGATION_PATHS.OVERVIEW;
    }
    return currentPath === href;
  };

  const canAccessCategory = (category: NavigationCategory): boolean => {
    if (!category.requiresRole || !userRole) return true;
    return category.requiresRole.includes(userRole);
  };

  const filterBySponsorTier = (
    items: NavigationCategory["items"],
  ): NavigationCategory["items"] => {
    return items.filter((item) => {
      if (
        item.href === NAVIGATION_PATHS.RESUME_DATABASE &&
        userRole === "Sponsor" &&
        user?.sponsorTier === "Bronze"
      ) {
        return false;
      }
      return true;
    });
  };

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  const filteredCategories = userRole
    ? navigationCategories.filter(canAccessCategory)
    : [];

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <Link
          to="/overview"
          className="flex items-center gap-2 group"
        >
          <img
            src="/logos/blue_logo_only.svg"
            alt="IEEE UCSD Logo"
            className="h-8 w-8 transition-transform group-hover:scale-105"
          />
          <span className="text-lg font-bold group-data-[collapsible=icon]:hidden">
            IEEE UCSD
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {isLoading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : (
          filteredCategories.map((category) => (
            <SidebarGroup key={category.title}>
              <SidebarGroupLabel
                className="cursor-pointer flex items-center justify-between"
                onClick={() => toggleGroup(category.title)}
              >
                <span>{category.title}</span>
                {expandedGroups.has(category.title) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </SidebarGroupLabel>
              {expandedGroups.has(category.title) && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterBySponsorTier(category.items).map((item) => {
                      const isActive = isActiveRoute(item.href);
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link to={item.href}>
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <div className="flex flex-col group-data-[collapsible=icon]:flex-col gap-1">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
            <DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex-1 justify-start gap-2 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                >
                  <Avatar size="sm">
                    <AvatarImage src={user?.avatar} alt={user?.name || "User"} />
                    <AvatarFallback>
                      <UserAvatarFallback name={user?.name || "User"} size="sm" className="h-6 w-6 text-xs" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="group-data-[collapsible=icon]:hidden truncate">
                    {user?.name || "User"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              {accountMenuOpen && (
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarImage src={user?.avatar} alt={user?.name || "User"} />
                        <AvatarFallback>
                          <UserAvatarFallback name={user?.name || "User"} size="sm" className="h-6 w-6 text-xs" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{user?.name || "User"}</p>
                        <p className="text-sm text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/settings"
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              )}
            </DropdownMenu>

            {/* AI Chat - Only for officers */}
            {["General Officer", "Executive Officer", "Administrator"].includes(
              userRole || "",
            ) &&
              user?.aiFeaturesEnabled !== false && (
              <div className="group-data-[collapsible=icon]:hidden">
                <OfficerAiChat />
              </div>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
