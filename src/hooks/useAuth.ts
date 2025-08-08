import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../firebase/client";
import { doc, getDoc } from "firebase/firestore";
import type { UserRole } from "../components/dashboard/shared/types/firestore";
import type { User } from "firebase/auth";

interface UseAuthResult {
  user: User | null;
  userRole: UserRole;
  loading: boolean;
  error: string | null;
}

export function useAuth(): UseAuthResult {
  const [authedUser] = useAuthState(auth);
  const [userRole, setUserRole] = useState<UserRole>("Member");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchRole = async () => {
      try {
        if (!authedUser) {
          if (isMounted) {
            setUserRole("Member");
            setLoading(false);
          }
          return;
        }

        const userDocSnap = await getDoc(doc(db, "users", authedUser.uid));
        if (userDocSnap.exists()) {
          const role = (userDocSnap.data().role || "Member") as UserRole;
          if (isMounted) setUserRole(role);
        } else {
          if (isMounted) setUserRole("Member");
        }
      } catch (e: any) {
        if (isMounted) setError(e?.message || "Failed to fetch user role");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRole();

    return () => {
      isMounted = false;
    };
  }, [authedUser]);

  return { user: authedUser ?? null, userRole, loading, error };
}
