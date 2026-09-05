import { useEffect, useRef, useState } from "react";
import { getAuthConfig, signInWithGoogle, SessionUser } from "../api";
import { renderGoogleButton } from "../googleAuth";

/* global window */

export default function Login({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getAuthConfig();
        if (cancelled) return;
        if (!cfg.configured || !cfg.googleClientId) {
          setNotConfigured(true);
          return;
        }
        if (!btnRef.current) return;
        await renderGoogleButton(btnRef.current, cfg.googleClientId, async (credential) => {
          try {
            setError(null);
            const { user } = await signInWithGoogle(credential);
            onSignedIn(user);
          } catch (e) {
            setError((e as Error).message);
          }
        });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onSignedIn]);

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand-mark">Suade</div>
        <p>
          Point-of-work AI for arbitration lawyers. Sign in to set up a matter, assemble your case
          theory, and generate a grounded first draft.
        </p>
        {notConfigured ? (
          <div className="error-banner" style={{ textAlign: "left" }}>
            Google sign-in isn&apos;t configured yet. Set <code>GOOGLE_CLIENT_ID</code> on the server
            (see the setup guide) and reload.
          </div>
        ) : (
          <div className="gbtn-holder" ref={btnRef} />
        )}
        {error && (
          <div className="error-banner" style={{ textAlign: "left" }}>
            {error}
          </div>
        )}
        <div className="login-foot">By continuing you agree to Suade&apos;s terms of use.</div>
      </div>
    </div>
  );
}
