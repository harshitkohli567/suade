import { useEffect, useRef, useState } from "react";
import { getAuthConfig, signInWithGoogle, SessionUser } from "../api";
import { renderGoogleButton } from "../googleAuth";
import { AlertIcon } from "./Icons";

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
        <div className="login-brand">
          Suade<span className="dot">.</span>
        </div>
        <div className="login-tag">Workspace</div>
        <p className="blurb">
          Point-of-work AI for arbitration lawyers. Sign in to set up a matter, assemble your case
          theory, and generate a grounded first draft.
        </p>
        {notConfigured ? (
          <div className="error-banner" style={{ textAlign: "left" }}>
            <AlertIcon size={16} />
            <span>
              Google sign-in isn&apos;t configured yet. Set <code>GOOGLE_CLIENT_ID</code> on the server and
              reload.
            </span>
          </div>
        ) : (
          <div className="gbtn-holder" ref={btnRef} />
        )}
        {error && (
          <div className="error-banner" style={{ textAlign: "left" }}>
            <AlertIcon size={16} />
            <span>{error}</span>
          </div>
        )}
        <div className="login-foot">By continuing you agree to Suade&apos;s terms of use.</div>
      </div>
    </div>
  );
}
