import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "./AppSidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotificationBell } from "./NotificationBell";
import { PATH_LABELS } from "@/config/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { resolveDashboardRedirect } from "@/lib/auth/dashboardRouting";

export function DashboardLayout() {
  const { isAuthenticated, isLoading, isAuthResolved, authFailureReason, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (authFailureReason) {
      navigate({ to: "/signin", replace: true });
      return;
    }

    const redirectPath = resolveDashboardRedirect({
      isAuthResolved,
      isAuthenticated,
      user,
      pathname: location.pathname,
    });
    if (redirectPath) {
      navigate({ to: redirectPath, replace: true });
    }
  }, [authFailureReason, isAuthResolved, isAuthenticated, user, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  if (isAuthResolved && !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar currentPath={location.pathname} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <nav className="flex items-center gap-1 text-sm flex-1">
            <span className="font-medium text-muted-foreground">Dashboard</span>
            {PATH_LABELS[location.pathname] && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="font-medium text-foreground">
                  {PATH_LABELS[location.pathname]}
                </span>
              </>
            )}
          </nav>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
