import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { changePasswordFailure, type PasswordFailure } from "@/lib/api-errors";
import { changePassword } from "@/lib/profile-api";

/**
 * Sends a password change. The passwords pass through as arguments only:
 * nothing here keeps or logs them. Resolves to null on success and to where
 * and what to show otherwise; no failure logs the user out, a wrong current
 * password included (the server answers it with 403, not 401).
 */
export function useChangePassword() {
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);
  // The same form sent twice (a double tap, Enter pressed twice) is one
  // request, and both calls get its outcome.
  const inFlight = useRef<Promise<PasswordFailure | null> | null>(null);

  function submit(
    currentPassword: string,
    newPassword: string,
  ): Promise<PasswordFailure | null> {
    if (inFlight.current) return inFlight.current;

    const run = async () => {
      setSaving(true);
      try {
        // Used under the logged-in layout only, so a token is always there.
        await changePassword(token!, currentPassword, newPassword);
        return null;
      } catch (error) {
        return changePasswordFailure(error);
      } finally {
        inFlight.current = null;
        setSaving(false);
      }
    };
    inFlight.current = run();
    return inFlight.current;
  }

  return { submit, saving };
}
