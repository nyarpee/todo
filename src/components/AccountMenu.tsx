"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogIn, LogOut, RefreshCw, UserCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase-client";

type AccountMenuProps = {
  syncStatus?: string | null;
};

export function AccountMenu({ syncStatus = null }: AccountMenuProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const supabase = getBrowserSupabaseClient();

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let isActive = true;

    async function loadSession() {
      const { data } = await client.auth.getSession();
      if (isActive) {
        setUser(data.session?.user ?? null);
      }
    }

    void loadSession();

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(null);
    });

    return () => {
      isActive = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  async function handleSignIn({ selectAccount = false }: { selectAccount?: boolean } = {}) {
    if (!supabase) {
      setStatus("Supabase env is not set.");
      return;
    }

    setStatus(null);
    const options = selectAccount
      ? {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: "select_account",
          },
        }
      : {
          redirectTo: window.location.origin,
        };

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options,
    });

    if (error) {
      setStatus(error.message);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;

    setStatus(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus(error.message);
      return;
    }

    setIsOpen(false);
  }

  return (
    <div className="accountMenu" ref={menuRef}>
      <button
        className="accountButton"
        type="button"
        aria-label={user ? "Open account menu" : "Open sign in menu"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <UserCircle size={19} aria-hidden="true" />
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="accountPopover" role="menu">
          <div className="accountSummary">
            <span>{user ? "Signed in" : "Local mode"}</span>
            <strong>{user?.email ?? "Not signed in"}</strong>
          </div>

          {!user ? (
            <p className="accountCloudCopy">
              Sync your todos with Google.
              <br />
              Access them anytime, on any device.
            </p>
          ) : null}

          {user && syncStatus ? <p className="accountCloudCopy">{syncStatus}</p> : null}

          {user ? (
            <>
              <button
                className="accountMenuItem"
                type="button"
                role="menuitem"
                onClick={() => handleSignIn({ selectAccount: true })}
              >
                <RefreshCw size={16} aria-hidden="true" />
                Switch account
              </button>
              <button className="accountMenuItem" type="button" role="menuitem" onClick={handleSignOut}>
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </>
          ) : (
            <button className="accountMenuItem" type="button" role="menuitem" onClick={() => handleSignIn()}>
              <LogIn size={16} aria-hidden="true" />
              Sign in with Google
            </button>
          )}

          {status ? <p className="accountStatus">{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
