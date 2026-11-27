"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useMessages } from "@/i18n/client";
import { buttonStyles } from "./button";
import { FormField } from "./form-field";
import { Icon } from "./icon";

type PasswordFieldProps = Omit<ComponentProps<typeof FormField>, "type" | "trailing" | "ref">;

/**
 * A `FormField` for passwords with an eye button that shows and hides what was typed. Submitting hides it again, so
 * the browser treats it as a password and never remembers it as ordinary text.
 */
export function PasswordField(props: PasswordFieldProps) {
  const text = useMessages().common;
  const inputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const label = visible ? text.hidePassword : text.showPassword;

  useEffect(() => {
    const form = inputRef.current?.form;
    const hide = () => setVisible(false);
    form?.addEventListener("submit", hide);
    return () => form?.removeEventListener("submit", hide);
  }, []);

  return (
    <FormField
      // A shown password must not be spell-checked (some browsers send the text away) or auto-capitalised.
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      {...props}
      ref={inputRef}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          // Keeps the cursor in the field (and the keyboard open on phones).
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
          aria-label={text.showPassword}
          aria-pressed={visible}
          title={label}
          className={buttonStyles({ variant: visible ? "selected" : "ghost", size: "icon", className: "absolute inset-y-0 right-0 h-full w-11 focus-visible:-outline-offset-2" })}
        >
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      }
    />
  );
}
