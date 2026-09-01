import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { FirebaseError } from "firebase/app";
import {
  browserLocalPersistence,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { AuthUserContext } from "./AuthContext";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>();

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser?.isAnonymous ? null : nextUser);
  }), []);

  if (user === undefined) {
    return <div className="auth-loading">Opening ATB Hatchlings…</div>;
  }

  if (!user) return <Login />;

  return (
    <>
      <AuthUserContext.Provider value={user}>
        <SessionHeader user={user} />
        {children}
      </AuthUserContext.Provider>
    </>
  );
}

function SessionHeader({ user }: { user: User }) {
  const [username, setUsername] = useState(user.displayName?.trim() || "Signed in");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [{ db }, { doc, getDoc }] = await Promise.all([
          import("./firestore"),
          import("firebase/firestore"),
        ]);
        const rootProfile = await getDoc(doc(db, "users", user.uid));
        if (cancelled) return;

        const rootData = rootProfile.data();
        const workspaceId = cleanString(rootData?.lastWorkspaceId);
        const rootUsername = cleanString(rootData?.username);
        let workspaceUsername: string | null = null;

        if (workspaceId) {
          const workspaceProfile = await getDoc(doc(db, "schools", workspaceId, "users", user.uid));
          if (cancelled) return;
          workspaceUsername = cleanString(workspaceProfile.data()?.username);
        }

        setUsername(workspaceUsername ?? rootUsername ?? user.displayName?.trim() ?? "Signed in");
      } catch {
        if (!cancelled) setUsername(user.displayName?.trim() || "Signed in");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="auth-session">
      <span>{username}</span>
      <button type="button" onClick={() => void signOut(auth)}>Sign out</button>
    </div>
  );
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function emailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await setPersistence(auth, browserLocalPersistence);
      const email = await resolveEmail(identifier);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Sign in with Apple, for staff whose account has no password.
   *
   * The iOS app no longer makes an Apple user create one (App Review
   * guideline 4 forbids it), so without this a staff member who signed up
   * with Apple has no way into this site at all.
   *
   * Needs an Apple Services ID and key configured under Firebase Console →
   * Authentication → Sign-in method → Apple. Until that exists Firebase
   * answers auth/operation-not-allowed, which authMessage spells out rather
   * than reporting as a generic failure.
   */
  async function appleLogin() {
    setBusy(true);
    setMessage("");
    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      await signInWithPopup(auth, provider);
    } catch (error) {
      // Closing the Apple window is a decision, not an error to report.
      if (error instanceof FirebaseError && error.code === "auth/popup-closed-by-user") return;
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!identifier.trim()) {
      setMessage("Enter your username or email first, then choose Forgot password.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const email = await resolveEmail(identifier);
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent.");
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-egg" aria-hidden="true" />
        <h1 id="login-title">ATB Hatchlings</h1>
        <p>Sign in with your staff account to open the classroom display.</p>

        <form onSubmit={emailLogin}>
          <label htmlFor="identifier">Username or email</label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setMessage("");
            }}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setMessage("");
            }}
            required
          />

          <button className="login-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <button className="forgot-password" type="button" onClick={() => void resetPassword()} disabled={busy}>
          Forgot password?
        </button>

        <div className="login-divider"><span>or</span></div>

        <button className="login-apple" type="button" onClick={() => void appleLogin()} disabled={busy}>
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M11.18 8.53c.02-1.6 1.31-2.37 1.37-2.41-.75-1.1-1.91-1.25-2.32-1.26-.99-.1-1.93.58-2.43.58-.5 0-1.27-.57-2.09-.55-1.07.02-2.06.62-2.61 1.58-1.11 1.93-.28 4.78.8 6.34.53.76 1.16 1.62 1.99 1.59.8-.03 1.1-.52 2.07-.52.96 0 1.24.52 2.09.5.86-.01 1.4-.78 1.93-1.55.61-.89.86-1.75.87-1.79-.02-.01-1.67-.64-1.69-2.51ZM9.6 3.8c.44-.53.74-1.27.66-2.01-.63.03-1.4.42-1.86.95-.41.47-.77 1.23-.67 1.95.7.06 1.42-.36 1.87-.89Z"
            />
          </svg>
          Sign in with Apple
        </button>

        {message && <div className="auth-message" role="status" aria-live="polite">{message}</div>}
      </section>
    </main>
  );
}

function authMessage(error: unknown): string {
  if (error instanceof UsernameNotFoundError) return "The username or password is incorrect.";
  if (!(error instanceof FirebaseError)) return "Sign-in failed. Please try again.";
  switch (error.code) {
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

class UsernameNotFoundError extends Error {}

async function resolveEmail(identifier: string): Promise<string> {
  const normalized = identifier.trim();
  if (normalized.includes("@")) return normalized;
  if (!normalized) throw new UsernameNotFoundError();

  const [{ db }, { doc, getDoc }] = await Promise.all([
    import("./firestore"),
    import("firebase/firestore"),
  ]);
  const username = normalized.toLocaleLowerCase();
  const snapshot = await getDoc(doc(db, "usernames", username));
  const email = snapshot.data()?.email;
  if (typeof email !== "string" || !email.trim()) throw new UsernameNotFoundError();
  return email.trim();
}
