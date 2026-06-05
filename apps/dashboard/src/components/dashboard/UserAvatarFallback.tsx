import { cn } from "@/lib/utils";

interface UserAvatarFallbackProps {
  name: string;
  size?: "sm" | "md" | "lg" | string;
  className?: string;
}

export function UserAvatarFallback({
  name,
  size = "md",
  className,
}: UserAvatarFallbackProps) {
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const sizeClasses: Record<string, string> = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
  };

  const actualSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div
      className={cn(
        "rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold shrink-0",
        actualSize,
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
