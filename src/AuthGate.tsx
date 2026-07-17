import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
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

  async function googleLogin() {
    setBusy(true);
    setMessage("");
    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (error) {
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

        <button className="google-login" type="button" onClick={() => void googleLogin()} disabled={busy}>
          Continue with Google
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
    case "auth/popup-closed-by-user": return "Google sign-in was cancelled.";
    case "auth/popup-blocked": return "Allow pop-ups for this site, then try Google again.";
    case "auth/network-request-failed": return "Could not reach Firebase. Check the internet connection.";
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
