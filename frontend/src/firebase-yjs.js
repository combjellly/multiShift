import { onChildAdded, push, ref } from 'firebase/database';
import * as Y from 'yjs';

// Helper to convert Uint8Array to Base64 string
function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 string to Uint8Array
function base64ToUint8Array(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

export class FirebaseProvider {
  constructor(database, path, ydoc) {
    this.ydoc = ydoc;
    this.updatesRef = ref(database, path);

    // Send local changes to Firebase
    ydoc.on('update', (update, origin) => {
      // Don't bounce back updates we just received
      if (origin !== this) {
        const base64Update = uint8ArrayToBase64(update);
        push(this.updatesRef, base64Update).catch(err => {
            console.error("Firebase push failed:", err);
        });
      }
    });

    // Receive external changes from Firebase
    onChildAdded(this.updatesRef, (snapshot) => {
      const base64Update = snapshot.val();
      if (typeof base64Update === 'string') {
        try {
          const update = base64ToUint8Array(base64Update);
          // Apply update and mark 'this' as the origin so we don't rebroadcast it
          Y.applyUpdate(this.ydoc, update, this);
        } catch (e) {
          console.error("Failed to apply update from Firebase:", e);
        }
      }
    });
  }
}
