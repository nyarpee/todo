"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe2, Lightbulb, LogIn, LogOut, RefreshCw, UserCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { APP_LANGUAGES, isAppLanguage } from "@/i18n/messages";
import { useLanguage } from "@/i18n/LanguageProvider";
import { getBrowserSupabaseClient } from "@/lib/supabase-client";

type AccountMenuProps = {
  syncStatus?: string | null;
};

export function AccountMenu({ syncStatus = null }: AccountMenuProps) {
  const { language, messages: text, setLanguage } = useLanguage();
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
      setStatus(text.account.missingSupabaseEnv);
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
        aria-label={user ? text.account.openAccountMenu : text.account.openSignInMenu}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <UserCircle size={19} aria-hidden="true" />
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="accountPopover" role="menu">
          <div className="accountSummary">
            <span>{user ? text.account.signedIn : text.account.localMode}</span>
            <strong>{user?.email ?? text.account.notSignedIn}</strong>
          </div>

          {!user ? (
            <p className="accountCloudCopy">
              {text.account.cloudCopy.split("\n").map((line, index) => (
                <span key={`${line}-${index}`}>
                  {line}
                  {index === 0 ? <br /> : null}
                </span>
              ))}
            </p>
          ) : null}

          {user && syncStatus ? <p className="accountCloudCopy">{syncStatus}</p> : null}

          <label className="accountLanguageRow">
            <span>
              <Globe2 size={16} aria-hidden="true" />
              {text.account.language}
            </span>
            <select
              aria-label={text.account.language}
              value={language}
              onChange={(event) => {
                const nextLanguage = event.target.value;
                if (isAppLanguage(nextLanguage)) {
                  setLanguage(nextLanguage);
                }
              }}
            >
              {APP_LANGUAGES.map((appLanguage) => (
                <option key={appLanguage.value} value={appLanguage.value}>
                  {appLanguage.label}
                </option>
              ))}
            </select>
          </label>

          <a
            className="accountMenuItem"
            href={FEEDBACK_FORM_URL}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
          >
            <Lightbulb size={16} aria-hidden="true" />
            {text.account.message}
          </a>

          {user ? (
            <>
              <button
                className="accountMenuItem"
                type="button"
                role="menuitem"
                onClick={() => handleSignIn({ selectAccount: true })}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {text.account.switchAccount}
              </button>
              <button className="accountMenuItem" type="button" role="menuitem" onClick={handleSignOut}>
                <LogOut size={16} aria-hidden="true" />
                {text.account.signOut}
              </button>
            </>
          ) : (
            <button className="accountMenuItem" type="button" role="menuitem" onClick={() => handleSignIn()}>
              <LogIn size={16} aria-hidden="true" />
              {text.account.signIn}
            </button>
          )}

          {status ? <p className="accountStatus">{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSf1oAkk7EkN1Sfnx0KUn7xDnJC-YjH7p8GEoFeCYaJlj9JloA/viewform?usp=publish-editor";
