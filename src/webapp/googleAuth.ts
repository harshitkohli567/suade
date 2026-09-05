/**
 * Thin wrapper over Google Identity Services (the gsi/client script loaded
 * in webapp.html). Waits for the script, initializes with the server's
 * client ID, and renders the official Google button.
 */

/* global window, document */

declare global {
  interface Window {
    google?: any;
  }
}

function waitForGoogle(timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        resolve(window.google.accounts.id);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Google sign-in failed to load. Check your connection and retry."));
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

export async function renderGoogleButton(
  container: HTMLElement,
  clientId: string,
  onCredential: (credential: string) => void
): Promise<void> {
  const gid = await waitForGoogle();
  gid.initialize({
    client_id: clientId,
    callback: (response: { credential?: string }) => {
      if (response && response.credential) onCredential(response.credential);
    },
  });
  gid.renderButton(container, {
    theme: "outline",
    size: "large",
    type: "standard",
    shape: "pill",
    text: "signin_with",
    logo_alignment: "left",
    width: 280,
  });
}
