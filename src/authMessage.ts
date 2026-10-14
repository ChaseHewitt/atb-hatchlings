/**
 * What to tell someone when signing in or asking for a password reset fails.
 *
 * Reads the error's `code` instead of testing for FirebaseError, so it has no
 * imports and can be tested without the Firebase client.
 */
export function authMessage(error: unknown): string {
  const code = errorCode(error);
  if (code.startsWith("functions/")) return callableMessage(code, error);

  switch (code) {
    case "auth/invalid-credential": return "The username, email, or password is incorrect.";
    case "auth/invalid-email": return "Enter a valid username or email address.";
    case "auth/user-disabled": return "This account has been disabled.";
    case "auth/too-many-requests": return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed": return "Could not reach Firebase. Check the internet connection.";
    case "auth/operation-not-allowed":
      return "Sign in with Apple is not enabled for this project yet. Enable Apple under Firebase Authentication, then try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the Apple sign-in window. Allow pop-ups for this site and try again.";
    case "auth/account-exists-with-different-credential":
      return "That Apple ID's email already has an account here. Sign in with your username and password instead.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised for sign-in. Add it under Firebase Authentication settings.";
    default: return "Sign-in failed. Please try again.";
  }
}

/**
 * Username sign-in and password reset go through Cloud Functions.
 *
 * `unauthenticated` has two meanings there. The sign-in function answers a
 * wrong username or password with it and the reason below. App Check answers
 * with the same code, and no reason, when it could not verify this page, so
 * without the reason nothing is known about the password.
 */
function callableMessage(code: string, error: unknown): string {
  switch (code) {
    case "functions/unauthenticated":
      return errorReason(error) === "invalid-credentials"
        ? "The username, email, or password is incorrect."
        : "We couldn't verify this browser, so that isn't available right now. Reload the page and try again.";
    case "functions/resource-exhausted":
      return "Too many attempts. Try again later, or sign in with your email address.";
    default: return "Sign-in is temporarily unavailable. Try again shortly.";
  }
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" ? code : "";
}

function errorReason(error: unknown): unknown {
  const details = (error as { details?: unknown } | null | undefined)?.details;
  return (details as { reason?: unknown } | null | undefined)?.reason;
}
