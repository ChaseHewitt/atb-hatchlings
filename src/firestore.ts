import { getFirestore } from "firebase/firestore";
import { firebaseApp } from "./firebase";

// Kept separate so the larger Firestore client loads only when real data is used.
export const db = getFirestore(firebaseApp);
