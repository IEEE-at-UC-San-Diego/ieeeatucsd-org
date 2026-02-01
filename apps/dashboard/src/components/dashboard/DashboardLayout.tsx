/**
 * Dashboard Layout Component
 *
 * Main layout wrapper for all dashboard routes.
 * Provides sidebar navigation, top navbar, and responsive design.
 */

import { useState, useEffect, useMemo } from "react";
import { Outlet, Link, useLocation } from "@tanstack/react-router";
import { useLogto } from "@logto/react";
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
  ChevronDown,
  ChevronRight,
  Award,
  ClipboardList,
  Menu,
} from "lucide-react";

import { NAVIGATION_ITEMS, type UserRole, type NavigationCategory } from "@/config/navigation";
import { requireAnyRole } from "@/lib/dashboard/guards";
import { useUserRoles } from "@/lib/user/hooks";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const { signOut, fetchUserInfo } = useLogto();
  const { roles, isLoading: rolesLoading } = useUserRoles();
  const [userInfo, setUserInfo] = useState<{ name?: string; email?: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(NAVIGATION_ITEMS.map(cat => cat.title)));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch user info
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const info = await fetchUserInfo();
        setUserInfo({
          name: info.name || info.username,
          email: info.email,
        });
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      }
    };
    fetchUser();
  }, [fetchUserInfo]);

  // Filter navigation based on user roles
  const filteredNavCategories = useMemo(() => {
    if (roles.length === 0) return [];
    return NAVIGATION_ITEMS.filter(category => 
      !category.requiresRole || requireAnyRole(roles, category.requiresRole)
    );
  }, [roles]);

  const primaryRole: UserRole = roles.length > 0 ? (roles[0] as UserRole) : "member";

  const isActiveRoute = (path: string): boolean => {
    if (location.pathname === "/" || location.pathname === "") {
      return path === "/overview";
    }
    return location.pathname === path;
  };

  const handleSignOut = async () => {
    await signOut(window.location.origin);
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

  const NavigationItem = ({ item, isMobile }: { item: typeof NAVIGATION_ITEMS[0]["items"][0]; isMobile?: boolean }) => {
    const active = isActiveRoute(item.path);
    const Icon = item.icon;

    const baseClasses = isMobile
      ? "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
      : "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors rounded-md";

    const activeClasses = "bg-accent text-accent-foreground";
    const inactiveClasses = "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground";

    return (
      <Link
        to={item.path}
        className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}
        onClick={() => setMobileMenuOpen(false)}
      >
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        <span>{item.label}</span>
      </Link>
    );
  };

  const NavigationGroup = ({ category, isMobile }: { category: NavigationCategory; isMobile?: boolean }) => {
    const isExpanded = expandedGroups.has(category.title);

    return (
      <div className={isMobile ? "mb-4" : "mb-6"}>
        <button
          onClick={() => toggleGroup(category.title)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          <span>{category.title}</span>
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {isExpanded && (
          <nav className={isMobile ? "mt-2 space-y-1" : "mt-2 space-y-1 pl-2"}>
            {category.items.map((item) => (
              <NavigationItem key={item.path} item={item} isMobile={isMobile} />
            ))}
          </nav>
        )}
      </div>
    );
  };

  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/logos/blue_logo_only.svg" alt={userInfo?.name} />
            <AvatarFallback>
              {userInfo?.name?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userInfo?.name || "User"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userInfo?.email || "user@example.com"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const Sidebar = ({ isMobile }: { isMobile?: boolean }) => {
    if (rolesLoading || filteredNavCategories.length === 0) {
      return null;
    }

    const content = (
      <div className={isMobile ? "p-6" : "flex h-full flex-col"}>
        {/* Logo */}
        {!isMobile && (
          <div className="flex h-16 items-center border-b px-6">
            <Link
              to="/overview"
              className="flex items-center gap-2 font-semibold"
            >
              <img
                src="/logos/blue_logo_only.svg"
                alt="IEEE UCSD"
                className="h-8 w-8"
              />
              <span>IEEE UCSD</span>
            </Link>
          </div>
        )}

        {/* Navigation */}
        <div className={isMobile ? "mt-4" : "flex-1 overflow-y-auto py-6"}>
          {filteredNavCategories.map((category) => (
            <NavigationGroup key={category.title} category={category} isMobile={isMobile} />
          ))}
        </div>

        {/* Footer */}
        {!isMobile && (
          <div className="border-t p-4 space-y-4">
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/logos/blue_logo_only.svg" />
                  <AvatarFallback>
                    {userInfo?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium">{userInfo?.name || "User"}</p>
                  <Badge variant="secondary" className="text-xs w-fit">
                    {primaryRole.replace("_", " ")}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );

    if (isMobile) {
      return content;
    }

    return (
      <div className="hidden md:flex w-64 flex-col border-r bg-background">
        {content}
      </div>
    );
  };

  const TopNav = () => (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6">
        {/* Mobile menu trigger */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <Sidebar isMobile />
          </SheetContent>
        </Sheet>

        {/* Breadcrumb / Page title */}
        <div className="flex-1">
          <Link to="/overview" className="flex items-center gap-2 md:hidden">
            <img
              src="/logos/blue_logo_only.svg"
              alt="IEEE UCSD"
              className="h-6 w-6"
            />
            <span className="font-semibold">IEEE UCSD</span>
          </Link>
        </div>

        {/* User menu */}
        <div className="hidden md:flex items-center gap-4">
          <UserMenu />
        </div>
      </div>
    </header>
  );

  if (rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile TopNav */}
        <TopNav />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
