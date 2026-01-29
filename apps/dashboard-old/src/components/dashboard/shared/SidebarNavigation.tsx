import React, { useState, useEffect } from "react";
import {
  Home,
  Calendar,
  CreditCard,
  Settings,
  LogOut,
  Users,
  DollarSign,
  Trophy,
  Banknote,
  FileText,
  MessageSquare,
  Link as LinkIcon,
  Briefcase,
  Building2,
  UserPlus,
  User,
  ChevronDown,
  ChevronRight,
  Award,
  ClipboardList,
} from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../firebase/client.ts";
import type { NavigationCategory } from "./types/navigation.ts";
import type { UserRole } from "./types/firestore.ts";
import { NAVIGATION_PATHS } from "./types/navigation.ts";
import { SyncStatusIndicator } from "./components/SyncStatusIndicator.tsx";
import { OfficerAiChat } from "./OfficerAiChat.tsx";
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
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "../../ui/sidebar.tsx";
import {
  Navbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@heroui/react";
import { Button } from "../../ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu.tsx";

interface SidebarNavigationProps {
  currentPath?: string;
  children?: React.ReactNode;
}

interface UserType {
  name: string;
  email: string;
  points?: number;
  role?: UserRole;
  sponsorTier?: string;
}

const navigationCategories: NavigationCategory[] = [
  {
    title: "Member Actions",
    items: [
      { icon: Home, label: "Overview", href: NAVIGATION_PATHS.OVERVIEW },
      { icon: LinkIcon, label: "Links", href: NAVIGATION_PATHS.LINKS },
      { icon: Calendar, label: "Events", href: NAVIGATION_PATHS.EVENTS },
      {
        icon: CreditCard,
        label: "Reimbursement",
        href: NAVIGATION_PATHS.REIMBURSEMENT,
      },
      {
        icon: Trophy,
        label: "Leaderboard",
        href: NAVIGATION_PATHS.LEADERBOARD,
      },
    ],
  },
  {
    title: "General Officers",
    requiresRole: ["General Officer", "Executive Officer", "Administrator"],
    items: [
      {
        icon: Calendar,
        label: "Manage Events",
        href: NAVIGATION_PATHS.MANAGE_EVENTS,
      },
      {
        icon: Banknote,
        label: "Fund Deposits",
        href: NAVIGATION_PATHS.FUND_DEPOSITS,
      },
      {
        icon: ClipboardList,
        label: "Fund Requests",
        href: NAVIGATION_PATHS.FUND_REQUESTS,
      },
      {
        icon: MessageSquare,
        label: "Slack Access",
        href: NAVIGATION_PATHS.SLACK_ACCESS,
      },
      {
        icon: Trophy,
        label: "Officer Leaderboard",
        href: NAVIGATION_PATHS.OFFICER_LEADERBOARD,
      },
    ],
  },
  {
    title: "Executive Officers",
    requiresRole: ["Executive Officer", "Administrator"],
    items: [
      {
        icon: DollarSign,
        label: "Manage Reimbursements",
        href: NAVIGATION_PATHS.MANAGE_REIMBURSEMENTS,
      },
      {
        icon: ClipboardList,
        label: "Manage Fund Requests",
        href: NAVIGATION_PATHS.MANAGE_FUND_REQUESTS,
      },
      {
        icon: Users,
        label: "Manage Users",
        href: NAVIGATION_PATHS.MANAGE_USERS,
      },
      {
        icon: Building2,
        label: "Manage Sponsors",
        href: NAVIGATION_PATHS.MANAGE_SPONSORS,
      },
      {
        icon: UserPlus,
        label: "Onboarding",
        href: NAVIGATION_PATHS.ONBOARDING,
      },
      {
        icon: FileText,
        label: "Constitution Builder",
        href: NAVIGATION_PATHS.CONSTITUTION_BUILDER,
      },
    ],
  },
  {
    title: "Sponsors",
    requiresRole: ["Sponsor", "Administrator"],
    items: [
      {
        icon: Briefcase,
        label: "Resume Database",
        href: NAVIGATION_PATHS.RESUME_DATABASE,
      },
      {
        icon: Building2,
        label: "Sponsor Information",
        href: NAVIGATION_PATHS.SPONSOR_INFORMATION,
      },
    ],
  },
];

function SidebarNavigationContent({ currentPath = "" }: { currentPath?: string }) {
  const [user, userLoading] = useAuthState(auth);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [sponsorTier, setSponsorTier] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [userData, setUserData] = useState<UserType | null>(null);
  const [unreadCount] = useState(0);
  // Initialize with all navigation categories expanded by default
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(navigationCategories.map(cat => cat.title))
  );

  const filterBySponsorTier = (items: typeof navigationCategories[0]["items"]) => {
    return items.filter((item) => {
      if (
        item.href === NAVIGATION_PATHS.RESUME_DATABASE &&
        currentUserRole === "Sponsor" &&
        sponsorTier === "Bronze"
      ) {
        return false;
      }
      return true;
    });
  };

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      setCurrentUserRole(null);
      setIsLoadingRole(false);
      return;
    }

    setIsLoadingRole(true);

    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      (userDoc) => {
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCurrentUserRole(data.role || "Member");
          setSponsorTier(data.sponsorTier || null);
          setUserData({
            name: data.name || "User",
            email: data.email || user.email || "",
            points: data.points || 0,
            role: data.role || "Member",
          });
        } else {
          setCurrentUserRole("Member");
        }
        setIsLoadingRole(false);
      },
      (error) => {
        console.error("Error fetching user role:", error);
        setCurrentUserRole("Member");
        setIsLoadingRole(false);
      }
    );

    return () => unsubscribe();
  }, [user, userLoading]);

  const isActiveRoute = (href: string): boolean => {
    if (currentPath === "/" || currentPath === "/") {
      return href === NAVIGATION_PATHS.OVERVIEW;
    }
    return currentPath === href;
  };

  const canAccessCategory = (category: NavigationCategory): boolean => {
    if (!category.requiresRole || !currentUserRole) return true;
    return category.requiresRole.includes(currentUserRole);
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      window.location.href = "/signin";
    } catch (error) {
      console.error("Error signing out:", error);
    }
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

  const isLoading = userLoading || isLoadingRole;
  const filteredCategories = currentUserRole
    ? navigationCategories.filter(canAccessCategory)
    : [];

  return (
    <Sidebar collapsible="icon" className="border-r flex flex-col h-full">
      <SidebarHeader className="border-b p-4 flex-shrink-0">
        <a href={NAVIGATION_PATHS.OVERVIEW} className="flex items-center gap-2 group">
          <img
            src="/logos/blue_logo_only.svg"
            alt="IEEE UCSD Logo"
            className="w-8 h-8 transition-transform group-hover:scale-105"
          />
          <span className="text-lg font-bold group-data-[collapsible=icon]:hidden">
            IEEE UCSD
          </span>
        </a>
      </SidebarHeader>

      <SidebarContent className="flex-1 sidebar-thin-scroll">
        {!isLoading &&
          filteredCategories.map((category) => (
            <SidebarGroup key={category.title}>
              <SidebarGroupLabel
                className="cursor-pointer flex items-center justify-between"
                onClick={() => toggleGroup(category.title)}
              >
                <span>{category.title}</span>
                {expandedGroups.has(category.title) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
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
                            <a href={item.href}>
                              <Icon className="w-4 h-4" />
                              <span>{item.label}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-2 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2 group-data-[collapsible=icon]:mb-0 group-data-[collapsible=icon]:justify-center">
          <SyncStatusIndicator />
        </div>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
          <SidebarTrigger className="flex-shrink-0 group-data-[collapsible=icon]:w-full" />

          {["General Officer", "Executive Officer", "Administrator"].includes(currentUserRole || "") && (
            <div className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <OfficerAiChat />
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex-1 justify-start gap-2 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
              >
                <User className="w-4 h-4 flex-shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden truncate">
                  {userData?.name || "User"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-semibold">{userData?.name || "User"}</p>
                  <p className="text-sm text-gray-500">{userData?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={NAVIGATION_PATHS.SETTINGS} className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar >
  );
}

export function SidebarNavigation({ currentPath, children }: SidebarNavigationProps) {
  const [user, userLoading] = useAuthState(auth);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [sponsorTier, setSponsorTier] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState<UserType | null>(null);

  // Helper function to filter navigation items based on sponsor tier
  const filterBySponsorTier = (items: typeof navigationCategories[0]["items"]) => {
    return items.filter((item) => {
      // Hide Resume Database for Bronze tier sponsors
      if (
        item.href === NAVIGATION_PATHS.RESUME_DATABASE &&
        currentUserRole === "Sponsor" &&
        sponsorTier === "Bronze"
      ) {
        return false;
      }
      return true;
    });
  };

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      setCurrentUserRole(null);
      setIsLoadingRole(false);
      return;
    }

    setIsLoadingRole(true);

    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      (userDoc) => {
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCurrentUserRole(data.role || "Member");
          setSponsorTier(data.sponsorTier || null);
          setUserData({
            name: data.name || "User",
            email: data.email || user.email || "",
            points: data.points || 0,
            role: data.role || "Member",
          });
        } else {
          setCurrentUserRole("Member");
        }
        setIsLoadingRole(false);
      },
      (error) => {
        console.error("Error fetching user role:", error);
        setCurrentUserRole("Member");
        setIsLoadingRole(false);
      }
    );

    return () => unsubscribe();
  }, [user, userLoading]);

  const isActiveRoute = (href: string): boolean => {
    if (currentPath === "/" || currentPath === "/") {
      return href === NAVIGATION_PATHS.OVERVIEW;
    }
    return currentPath === href;
  };

  const canAccessCategory = (category: NavigationCategory): boolean => {
    if (!category.requiresRole || !currentUserRole) return true;
    return category.requiresRole.includes(currentUserRole);
  };

  const isLoading = userLoading || isLoadingRole;
  const filteredCategories = currentUserRole
    ? navigationCategories.filter(canAccessCategory)
    : [];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        {/* Desktop Sidebar - Hidden on mobile */}
        <div className="hidden md:block">
          <SidebarNavigationContent currentPath={currentPath} />
        </div>

        <SidebarInset className="flex-1 overflow-auto">
          {/* Mobile Navigation Bar with HeroUI Navbar - Only visible on mobile */}
          <Navbar
            isMenuOpen={isMenuOpen}
            onMenuOpenChange={setIsMenuOpen}
            maxWidth="full"
            className="md:hidden bg-sidebar border-b border-sidebar-border sticky top-0 z-50"
            classNames={{
              wrapper: "px-4",
            }}
            motionProps={{
              initial: { opacity: 0, y: -20 },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -20 },
              transition: { duration: 0.2, ease: "easeInOut" },
            }}
          >
            {/* Mobile Brand */}
            <NavbarContent justify="start">
              <div className="flex items-center gap-2">
                <img
                  src="/logos/blue_logo_only.svg"
                  alt="IEEE UCSD Logo"
                  className="w-6 h-6"
                />
                <span className="text-sm font-bold text-sidebar-foreground">
                  IEEE UCSD
                </span>
              </div>
            </NavbarContent>

            {/* Mobile Menu Toggle on the right */}
            <NavbarContent justify="end">
              <NavbarMenuToggle
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                className="text-sidebar-foreground"
              />
            </NavbarContent>

            {/* Mobile Menu - Full screen overlay */}
            <NavbarMenu className="pt-6 pb-[33vh] bg-sidebar border-t border-sidebar-border">
              {!isLoading &&
                filteredCategories.map((category) => (
                  <div key={category.title} className="mb-4">
                    <p className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2 px-2">
                      {category.title}
                    </p>
                    {filterBySponsorTier(category.items).map((item) => {
                      const isActive = isActiveRoute(item.href);
                      const Icon = item.icon;
                      return (
                        <NavbarMenuItem key={item.href} isActive={isActive}>
                          <a
                            href={item.href}
                            aria-label={`Navigate to ${item.label}`}
                            aria-current={isActive ? "page" : undefined}
                            className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all w-full ${isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }`}
                          >
                            <Icon className="w-5 h-5" aria-hidden="true" />
                            <span>{item.label}</span>
                          </a>
                        </NavbarMenuItem>
                      );
                    })}
                  </div>
                ))}

              {/* Mobile Profile Section */}
              {!isLoading && userData && (
                <div className="mt-6 pt-4 border-t border-sidebar-border">
                  <p className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2 px-2">
                    Account
                  </p>

                  {/* User Info */}
                  <NavbarMenuItem>
                    <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg w-full text-sidebar-foreground">
                      <User className="w-5 h-5" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {userData.name}
                        </p>
                        <p className="text-sm text-sidebar-foreground/60 truncate">
                          {userData.email}
                        </p>
                      </div>
                    </div>
                  </NavbarMenuItem>

                  {/* Points Display */}
                  <NavbarMenuItem>
                    <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg w-full text-sidebar-foreground">
                      <Award className="w-5 h-5 text-yellow-600" aria-hidden="true" />
                      <div className="flex-1 flex items-center justify-between">
                        <span>Points</span>
                        <span className="font-bold text-yellow-600">
                          {userData.points || 0}
                        </span>
                      </div>
                    </div>
                  </NavbarMenuItem>

                  {/* Settings Link */}
                  <NavbarMenuItem>
                    <a
                      href={NAVIGATION_PATHS.SETTINGS}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <Settings className="w-5 h-5" aria-hidden="true" />
                      <span>Settings</span>
                    </a>
                  </NavbarMenuItem>

                  {/* Sign Out Button */}
                  <NavbarMenuItem>
                    <button
                      onClick={async () => {
                        await auth.signOut();
                        window.location.href = "/signin";
                      }}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all w-full text-red-600 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <LogOut className="w-5 h-5" aria-hidden="true" />
                      <span>Sign Out</span>
                    </button>
                  </NavbarMenuItem>
                </div>
              )}
            </NavbarMenu>
          </Navbar>

          {/* Main Content */}
          <div className="flex-1">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

