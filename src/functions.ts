import { getFunctions } from "firebase/functions";
import { firebaseApp } from "./firebase";

// Kept separate, like Firestore, so the Functions client loads only when a
// username sign-in or a password reset needs it. us-east4 is where the ATB
// functions run.
export const functions = getFunctions(firebaseApp, "us-east4");
