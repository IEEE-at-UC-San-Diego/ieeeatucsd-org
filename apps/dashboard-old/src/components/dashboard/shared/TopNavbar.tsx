import React, { useState, useEffect } from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
  Badge,
  Button,
  Tooltip,
} from "@heroui/react";
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
  Bell,
  User,
  Award,
  ChevronDown,
} from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../firebase/client.ts";
import type { NavigationCategory } from "./types/navigation.ts";
import type { UserRole } from "./types/firestore.ts";
import { NAVIGATION_PATHS } from "./types/navigation.ts";
import { SyncStatusIndicator } from "./components/SyncStatusIndicator.tsx";

interface TopNavbarProps {
  currentPath?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: string;
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

export function TopNavbar({ currentPath = "" }: TopNavbarProps) {
  const [user, userLoading] = useAuthState(auth);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [sponsorTier, setSponsorTier] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userData, setUserData] = useState<UserType | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Use db from client import

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

    // Set up real-time listener for user data
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
          // No explicit role set in Firestore; default to Member to avoid indefinite loading state
          setCurrentUserRole("Member");
        }
        setIsLoadingRole(false);
      },
      (error) => {
        console.error("Error fetching user role:", error);
        // On error, default to Member to avoid indefinite loading state
        setCurrentUserRole("Member");
        setIsLoadingRole(false);
      }
    );

    return () => unsubscribe();
  }, [user, userLoading]);

  // Fetch notifications (deferred until notifications are active)
  // Since notifications are under development, we don't set up listeners yet
  useEffect(() => {
    // Defer notification setup until feature is fully implemented
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // TODO: Enable notification listener when feature is active
    // const notificationsQuery = query(
    //   collection(db, "notifications"),
    //   where("userId", "==", user.uid)
    // );
    //
    // const unsubscribe = onSnapshot(/* notification query */);
    // return () => unsubscribe();

    // For now, keep empty state
    setNotifications([]);
    setUnreadCount(0);
  }, [user]);

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

  // Flatten all navigation items for desktop display
  const allNavItems = filteredCategories.flatMap((category) =>
    filterBySponsorTier(category.items)
  );

  return (
    <Navbar
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      maxWidth="full"
      className="bg-sidebar border-b border-sidebar-border"
      classNames={{
        wrapper: "px-4 sm:px-6",
        item: "text-sidebar-foreground data-[active=true]:text-sidebar-foreground",
      }}
      motionProps={{
        initial: { opacity: 0, y: -20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.2, ease: "easeInOut" },
      }}
    >
      {/* Brand */}
      <NavbarContent justify="start">
        <NavbarBrand>
          <a href={NAVIGATION_PATHS.OVERVIEW} className="flex items-center gap-2 group">
            <img
              src="/logos/blue_logo_only.svg"
              alt="IEEE UCSD Logo"
              className="w-8 h-8 transition-transform group-hover:scale-105"
            />
            <span className="text-lg font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              IEEE UCSD
            </span>
          </a>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop Navigation Links */}
      <NavbarContent className="hidden lg:flex gap-1" justify="center">
        {!isLoading &&
          allNavItems.slice(0, 6).map((item) => {
            const isActive = isActiveRoute(item.href);
            const Icon = item.icon;
            return (
              <NavbarItem key={item.href} isActive={isActive}>
                <a
                  href={item.href}
                  aria-label={`Navigate to ${item.label}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm">{item.label}</span>
                </a>
              </NavbarItem>
            );
          })}

        {/* More dropdown for additional items */}
        {!isLoading && allNavItems.length > 6 && (
          <Dropdown
            classNames={{
              content: "bg-sidebar border border-sidebar-border shadow-lg",
            }}
          >
            <NavbarItem>
              <DropdownTrigger>
                <Button
                  disableRipple
                  className="p-0 bg-transparent data-[hover=true]:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"
                  endContent={<ChevronDown className="w-4 h-4" />}
                  radius="sm"
                  variant="light"
                >
                  More
                </Button>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu aria-label="More navigation items">
              {allNavItems.slice(6).map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownItem
                    key={item.href}
                    startContent={<Icon className="w-4 h-4" />}
                    href={item.href}
                  >
                    {item.label}
                  </DropdownItem>
                );
              })}
            </DropdownMenu>
          </Dropdown>
        )}
      </NavbarContent>

      {/* Right side - Sync Status, Notifications & Profile */}
      <NavbarContent justify="end">
        {/* Sync Status Indicator */}
        <NavbarItem>
          <SyncStatusIndicator />
        </NavbarItem>

        {/* Notifications */}
        <NavbarItem>
          <Tooltip content="Under Development" placement="bottom" showArrow>
            <div className="inline-block">
              <Button
                isIconOnly
                variant="light"
                isDisabled
                className="text-sidebar-foreground/40 cursor-not-allowed"
                aria-label="Notifications (Under Development)"
              >
                <Badge content={unreadCount > 0 ? unreadCount : ""} color="danger" size="sm">
                  <Bell className="w-5 h-5" />
                </Badge>
              </Button>
            </div>
          </Tooltip>
        </NavbarItem>

        {/* Profile Dropdown */}
        <Dropdown
          placement="bottom-end"
          classNames={{
            content: "bg-sidebar border border-sidebar-border shadow-lg",
          }}
        >
          <NavbarItem>
            <DropdownTrigger>
              <Button
                isIconOnly
                variant="light"
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                aria-label="Profile"
              >
                <User className="w-5 h-5" />
              </Button>
            </DropdownTrigger>
          </NavbarItem>
          <DropdownMenu aria-label="Profile Actions" variant="flat">
            <DropdownItem key="profile" className="h-14 gap-2" textValue="Profile">
              <p className="font-semibold">{userData?.name || "User"}</p>
              <p className="text-sm text-gray-500">{userData?.email}</p>
            </DropdownItem>
            <DropdownItem
              key="points"
              startContent={<Award className="w-4 h-4 text-yellow-600" />}
              textValue="Points"
            >
              <div className="flex justify-between items-center">
                <span>Points</span>
                <span className="font-bold text-yellow-600">{userData?.points || 0}</span>
              </div>
            </DropdownItem>
            <DropdownItem
              key="settings"
              startContent={<Settings className="w-4 h-4" />}
              href={NAVIGATION_PATHS.SETTINGS}
            >
              Settings
            </DropdownItem>
            <DropdownItem
              key="logout"
              startContent={<LogOut className="w-4 h-4" />}
              href={NAVIGATION_PATHS.SIGNOUT}
              className="text-danger"
              color="danger"
            >
              Sign Out
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>

        {/* Mobile Menu Toggle */}
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="lg:hidden text-sidebar-foreground"
        />
      </NavbarContent>

      {/* Mobile Menu */}
      <NavbarMenu className="pt-6 bg-sidebar border-t border-sidebar-border">
        {!isLoading &&
          filteredCategories.map((category) => (
            <div key={category.title} className="mb-4">
              <p className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2 px-2">
                {category.title}
              </p>
              {filterBySponsorTier(category.items)
                .map((item) => {
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
            <div className="px-2 py-3 mb-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <User className="w-5 h-5 text-sidebar-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sidebar-foreground truncate">
                    {userData.name}
                  </p>
                  <p className="text-sm text-sidebar-foreground/60 truncate">
                    {userData.email}
                  </p>
                </div>
              </div>

              {/* Points Display */}
              <div className="flex items-center justify-between px-3 py-2 bg-sidebar-accent/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-sidebar-foreground">Points</span>
                </div>
                <span className="font-bold text-yellow-600">
                  {userData.points || 0}
                </span>
              </div>
            </div>

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
                className="flex items-center gap-3 px-4 py-4 rounded-lg transition-all w-full text-red-600 hover:bg-red-50 min-h-[48px]"
              >
                <LogOut className="w-5 h-5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </NavbarMenuItem>
          </div>
        )}
      </NavbarMenu>
    </Navbar>
  );
}
