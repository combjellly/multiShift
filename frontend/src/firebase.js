import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyCtmYOcwOGLJiPx6vf8Un2POVGNcqqfKC0",
  authDomain: "shift-f4e26.firebaseapp.com",
  databaseURL: "https://shift-f4e26-default-rtdb.firebaseio.com",
  projectId: "shift-f4e26",
  storageBucket: "shift-f4e26.firebasestorage.app",
  messagingSenderId: "665791298297",
  appId: "1:665791298297:web:91c18537caaaea2bb24028",
  measurementId: "G-VEBZF24ZBW"
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase App Check with reCAPTCHA Enterprise (Fraud Defense)
if (typeof window !== "undefined") {
  try {
    if (import.meta.env.DEV) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider("6LeeeP8tAAAAADDP9fmkZqhU1xblSiAqcdqeeuzf"),
      isTokenAutoRefreshEnabled: true
    });
  } catch (err) {
    console.warn("Firebase App Check initialization warning:", err);
  }
}

export const database = getDatabase(app);
