import { onChildAdded, get, push, ref, query, orderByKey, limitToLast } from 'firebase/database';
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
  constructor(database, path, ydoc, readOnly = false) {
    this.ydoc = ydoc;
    this.updatesRef = ref(database, path);
    this._seenKeys = new Set();
    this._destroyed = false;
    this.readOnly = readOnly;

    // Expose a promise that resolves once all existing DB entries are applied.
    // The editor waits on this before rendering so users always see the last state.
    this.ready = this._loadExisting().then(() => {
      if (this._destroyed) return;
      this._subscribeToNew();
    });

    // Send local changes to Firebase (skip if readOnly or update arrived from Firebase)
    ydoc.on('update', (update, origin) => {
      if (origin !== this && !this._destroyed && !this.readOnly) {
        const base64Update = uint8ArrayToBase64(update);
        push(this.updatesRef, base64Update).catch(err => {
          console.error('Firebase push failed:', err);
        });
      }
    });
  }

  // Fetch ALL existing updates from Firebase and apply them in order.
  async _loadExisting() {
    try {
      const snapshot = await get(this.updatesRef);
      if (!snapshot.exists()) return;

      snapshot.forEach(child => {
        const base64Update = child.val();
        this._seenKeys.add(child.key);
        if (typeof base64Update === 'string') {
          try {
            const update = base64ToUint8Array(base64Update);
            Y.applyUpdate(this.ydoc, update, this);
          } catch (e) {
            console.error('Failed to apply existing update from Firebase:', e);
          }
        }
      });
    } catch (e) {
      console.error('Failed to load existing state from Firebase:', e);
    }
  }

  // Stream only updates that arrive AFTER the initial load.
  _subscribeToNew() {
    this._unsubscribe = onChildAdded(this.updatesRef, (snapshot) => {
      // Skip keys we already applied during _loadExisting
      if (this._seenKeys.has(snapshot.key)) return;

      const base64Update = snapshot.val();
      if (typeof base64Update === 'string') {
        try {
          const update = base64ToUint8Array(base64Update);
          Y.applyUpdate(this.ydoc, update, this);
        } catch (e) {
          console.error('Failed to apply realtime update from Firebase:', e);
        }
      }
    });
  }

  destroy() {
    this._destroyed = true;
    if (this._unsubscribe) this._unsubscribe();
  }
}
