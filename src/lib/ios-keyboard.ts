/**
 * iOS Safari only opens the soft keyboard when `focus()` runs inside the same
 * synchronous call stack as a user gesture (tap). When a bottom sheet mounts
 * asynchronously (state change -> re-render -> effect), that gesture chain is
 * broken and the keyboard never appears.
 *
 * The fix is the "focus proxy" trick: inside the opening tap we synchronously
 * focus a hidden input, which raises the keyboard immediately. Once the sheet's
 * real input mounts, focus is transferred to it — moving focus while the
 * keyboard is already up does NOT require a fresh gesture, so it stays visible.
 *
 * This is a no-op-safe single code path: on desktop/Android it simply focuses a
 * throwaway input and then hands off, with no visible effect.
 */

let proxyInput: HTMLElement | null = null;

function ensureProxy(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  if (proxyInput && proxyInput.isConnected) return proxyInput;

  // A contenteditable div, not an <input>: focusing a form control makes iOS
  // attach its prev/next/done keyboard assistant bar, and the compose flow's
  // real title field is a contenteditable too — matching kinds keeps the bar
  // away for the whole hand-off.
  const input = document.createElement("div");
  input.setAttribute("contenteditable", "plaintext-only");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  Object.assign(input.style, {
    position: "fixed",
    top: "0px",
    left: "0px",
    width: "1px",
    height: "1px",
    opacity: "0",
    // 16px keeps iOS from zooming the viewport when the input focuses.
    fontSize: "16px",
    border: "0",
    padding: "0",
    margin: "0",
    pointerEvents: "none",
    zIndex: "-1",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(input);
  proxyInput = input;
  return input;
}

/**
 * Call this synchronously inside the tap handler that opens a keyboard-bearing
 * sheet, before the state update that mounts it.
 */
export function primeKeyboard(): void {
  const proxy = ensureProxy();
  proxy?.focus({ preventScroll: true });
}
