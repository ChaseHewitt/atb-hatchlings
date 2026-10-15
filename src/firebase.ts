import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

for (const key of requiredConfig) {
  if (!firebaseConfig[key]) {
    throw new Error(`Missing Firebase configuration: VITE_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`);
  }
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Username sign-in and password reset go through Cloud Functions that turn
// away any request without an App Check token. Without a site key those two
// report that this browser could not be verified; signing in with an email or
// with Apple talks to Firebase Auth directly and still works, as does a
// session that is already signed in.
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
if (appCheckSiteKey) {
  if (import.meta.env.DEV) {
    // localhost is not on the production reCAPTCHA key, so a dev server uses
    // App Check's debug provider: it prints a token in the browser console to
    // register under Firebase console → App Check → Manage debug tokens, or
    // takes one already registered. Never part of a production build.
    (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(firebaseApp);
