import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
import type { UserRole } from "../components/shared/types/firestore";
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
    if (!authedUser) {
      setUserRole("Member");
      setLoading(false);
      setError(null); // Clear error state when not authenticated
      return;
    }

    setLoading(true);
    setError(null); // Clear previous errors when starting new listener

    // Set up real-time listener for user role
    const unsubscribe = onSnapshot(
      doc(db, "users", authedUser.uid),
      (userDocSnap) => {
        if (userDocSnap.exists()) {
          const role = (userDocSnap.data().role || "Member") as UserRole;
          setUserRole(role);
        } else {
          setUserRole("Member");
        }
        setLoading(false);
        setError(null); // Clear error state on successful snapshot
      },
      (e: any) => {
        setError(e?.message || "Failed to fetch user role");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [authedUser]);

  return { user: authedUser ?? null, userRole, loading, error };
}
