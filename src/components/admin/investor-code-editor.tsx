"use client";

import {
  createContext,
  startTransition,
  use,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { saveInvestorCodesAction } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputStyles } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { useMessages } from "@/i18n/client";
import { idleActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { KEEPS_PAGE_ATTRIBUTE } from "@/lib/keeps-page";

/** How long "N IDs saved" stays beside the month select. */
const SAVED_MESSAGE_MS = 5000;
/** A download from a page-keeping GET form may still fire `beforeunload`; it is let through for this long. */
const DOWNLOAD_GRACE_MS = 2000;

type Draft = { original: string; value: string };
type InvestorCodeChange = { userId: string; investorCode: string };

const normalizeCode = (value: string) => value.trim().toUpperCase();
const isChanged = (draft: Draft) => normalizeCode(draft.value) !== draft.original;

type EditorContextValue = {
  drafts: Record<string, Draft>;
  changedCount: number;
  pending: boolean;
  state: ActionState;
  savedMessage: string | null;
  startEditing: (userId: string, original: string) => void;
  edit: (userId: string, value: string) => void;
  /** Ends editing a row and drops its draft. */
  revert: (userId: string) => void;
  save: () => void;
  discardAll: () => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

function useInvestorCodeEditor(): EditorContextValue {
  const editor = use(EditorContext);
  if (!editor) {
    throw new Error("Investor ID cells and the save bar need an <InvestorCodeEditor> around them.");
  }
  return editor;
}

/** Puts every select of a form back to its rendered choice, e.g. the month after "Stay". */
function restoreSelects(form: HTMLFormElement) {
  for (const select of form.querySelectorAll("select")) {
    const rendered = Array.from(select.options).find((option) => option.defaultSelected);
    if (rendered) {
      select.value = rendered.value;
    }
  }
}

/**
 * Inline editing of investor IDs in the investor list: a click on an ID makes it editable, the save bar beside the
 * month select saves all changed IDs at once. While changes are unsaved, leaving the page asks first: links and
 * forms through our own dialog, a reload or closed tab through the browser's. Forms inside the list that keep the
 * page (deactivate, save) pass; GET forms (month, search) and forms outside it (sign-out) leave it.
 * The browser's back and forward buttons can't be held.
 */
export function InvestorCodeEditor({ children }: { children: ReactNode }) {
  const text = useMessages().admin.investorCodes;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [state, dispatch, pending] = useActionState(
    async (previousState: ActionState, changes: InvestorCodeChange[]) => {
      const result = await saveInvestorCodesAction(previousState, changes);
      if (result.status === "success") {
        // Only what was saved: an ID typed while saving stays a draft.
        setDrafts((current) =>
          Object.fromEntries(
            Object.entries(current).filter(
              ([userId, draft]) =>
                !changes.some(
                  (change) => change.userId === userId && change.investorCode === normalizeCode(draft.value),
                ),
            ),
          ),
        );
        clearTimeout(savedTimerRef.current);
        setSavedMessage(result.message);
        savedTimerRef.current = setTimeout(() => setSavedMessage(null), SAVED_MESSAGE_MS);
      }
      return result;
    },
    idleActionState,
  );

  const changes: InvestorCodeChange[] = Object.entries(drafts)
    .filter(([, draft]) => isChanged(draft))
    .map(([userId, draft]) => ({ userId, investorCode: normalizeCode(draft.value) }));
  const changedCount = changes.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Whether leaving needs confirmation. Turned off synchronously when the user chooses to leave, before the
  // navigation is replayed, so neither our listener nor `beforeunload` asks a second time.
  const guardRef = useRef(false);
  const leaveRef = useRef<{ proceed: () => void; cancel?: () => void } | null>(null);
  const downloadUntilRef = useRef(0);

  useEffect(() => {
    guardRef.current = changedCount > 0;
  }, [changedCount]);

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  useEffect(() => {
    const ask = (proceed: () => void, cancel?: () => void) => {
      leaveRef.current = { proceed, cancel };
      dialogRef.current?.showModal();
    };

    const onClick = (event: MouseEvent) => {
      if (!guardRef.current || event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return; // Opens a new tab or window; this page stays.
      }
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute("download") ||
        (anchor.target !== "" && anchor.target !== "_self") ||
        anchor.closest(`[${KEEPS_PAGE_ATTRIBUTE}]`)
      ) {
        return;
      }
      const url = new URL(anchor.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) {
        return; // Same page, e.g. a jump to an anchor.
      }
      event.preventDefault();
      ask(() => anchor.click());
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!guardRef.current || !(form instanceof HTMLFormElement)) {
        return;
      }
      if (form.closest(`[${KEEPS_PAGE_ATTRIBUTE}]`)) {
        if (form.method === "get") {
          downloadUntilRef.current = Date.now() + DOWNLOAD_GRACE_MS;
        }
        return;
      }
      if (containerRef.current?.contains(form) && form.method !== "get") {
        return;
      }
      event.preventDefault();
      const { submitter } = event;
      ask(
        () => form.requestSubmit(submitter),
        submitter ? undefined : () => restoreSelects(form),
      );
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // A reload, a closed tab or a typed address: only the browser's own question is possible there.
  useEffect(() => {
    if (changedCount === 0) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!guardRef.current || Date.now() < downloadUntilRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [changedCount]);

  // "Stay", Esc or the backdrop: the navigation is dropped (and a changed month select put back).
  useEffect(() => {
    const dialog = dialogRef.current;
    const onClose = () => {
      leaveRef.current?.cancel?.();
      leaveRef.current = null;
    };
    dialog?.addEventListener("close", onClose);
    return () => dialog?.removeEventListener("close", onClose);
  }, []);

  const leave = () => {
    const pendingLeave = leaveRef.current;
    leaveRef.current = null;
    dialogRef.current?.close();
    guardRef.current = false;
    setDrafts({});
    pendingLeave?.proceed();
  };

  const value: EditorContextValue = {
    drafts,
    changedCount,
    pending,
    state,
    savedMessage,
    startEditing: (userId, original) => {
      setSavedMessage(null);
      setDrafts((current) => (current[userId] ? current : { ...current, [userId]: { original, value: original } }));
    },
    edit: (userId, newValue) =>
      setDrafts((current) =>
        current[userId] ? { ...current, [userId]: { ...current[userId], value: newValue } } : current,
      ),
    revert: (userId) =>
      setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== userId))),
    save: () => {
      if (changedCount > 0 && !pending) {
        startTransition(() => dispatch(changes));
      }
    },
    discardAll: () => setDrafts({}),
  };

  return (
    <EditorContext value={value}>
      <div ref={containerRef} className="contents">
        {children}
      </div>
      <ConfirmDialog
        dialogRef={dialogRef}
        title={text.leaveTitle}
        confirmLabel={text.leave}
        cancelLabel={text.stay}
        onConfirm={leave}
      >
        {text.leaveBody(changedCount)}
      </ConfirmDialog>
    </EditorContext>
  );
}

type EditableInvestorCodeProps = {
  userId: string;
  code: string;
  investorName: string;
};

/** An investor ID in the list: a click turns it into a field. Enter saves all changes, Esc reverts this row. */
export function EditableInvestorCode({ userId, code, investorName }: EditableInvestorCodeProps) {
  const text = useMessages().admin.investorCodes;
  const editor = useInvestorCodeEditor();
  const errorId = useId();
  const draft = editor.drafts[userId];

  if (!draft) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.startEditing(userId, code)}
        title={text.editTitle}
        aria-label={text.editLabel(code, investorName)}
        className="group reference -mx-1 gap-1.5 px-1 underline decoration-line-strong decoration-dotted underline-offset-4 hover:decoration-accent-400"
      >
        {code}
        <Icon
          name="pencil"
          className="size-3 text-accent-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </Button>
    );
  }

  const { state } = editor;
  // A row's error belongs to the ID it was given for; it goes away once the ID is edited again.
  const error =
    state.status === "error" && state.values?.[userId] === normalizeCode(draft.value)
      ? state.fieldErrors?.[userId]
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      <input
        value={draft.value}
        onChange={(event) => editor.edit(userId, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            editor.save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            editor.revert(userId);
          }
        }}
        onBlur={() => {
          if (!isChanged(draft)) {
            editor.revert(userId);
          }
        }}
        // Opened by a click on the ID, so moving the focus here is expected.
        autoFocus
        readOnly={editor.pending}
        maxLength={20}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-label={text.inputLabel(investorName)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          inputStyles,
          "reference h-8 w-[10.5rem] px-2 py-1 text-xs uppercase",
          isChanged(draft) && !error && "ring-accent-400/70",
        )}
      />
      {error ? (
        <p id={errorId} className="max-w-40 text-xs whitespace-normal text-loss">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Beside the month select: "Save N IDs" and "Discard" while IDs are changed, then briefly "N IDs saved". */
export function InvestorCodeSaveBar() {
  const text = useMessages().admin.investorCodes;
  const { changedCount, pending, state, savedMessage, save, discardAll } = useInvestorCodeEditor();

  if (changedCount === 0) {
    return savedMessage ? (
      <p role="status" className="flex items-center gap-1.5 text-[13px] text-gain">
        <Icon name="shieldCheck" className="size-4" />
        {savedMessage}
      </p>
    ) : null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" className="h-8 rounded-none whitespace-nowrap" onClick={save} disabled={pending} aria-busy={pending}>
        {pending ? text.savePending : text.save(changedCount)}
      </Button>
      <Button
        size="sm"
        variant="danger"
        className="h-8 rounded-none border-loss bg-loss whitespace-nowrap text-white hover:brightness-90 active:border-loss active:bg-loss active:text-white"
        onClick={discardAll}
        disabled={pending}
      >
        {text.discard}
      </Button>
      {state.status === "error" && !pending ? (
        <p role="alert" className="text-[13px] text-loss">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
