// The pieces that open over a page, on Base UI (@base-ui/react 1.9, MIT): focus moves in and comes back, Escape closes,
// arrow keys and typeahead work, and nothing is clipped by the box it opens from. Base UI draws nothing; kit.css does.
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { Select } from "@base-ui/react/select";
import { Toast } from "@base-ui/react/toast";
import { Tooltip } from "@base-ui/react/tooltip";
import { useRef, type ReactElement, type ReactNode } from "react";
import { Icon, Spinner, cx, type IconName } from "./kit";

/** Wrap the app once, so toasts have their viewport and tooltips share one delay: <Overlays><App /></Overlays>. */
export function Overlays({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={6000} limit={3}>
      <Tooltip.Provider delay={400}>{children}</Tooltip.Provider>
      <Toast.Portal>
        <Toast.Viewport className="dl-toasts"><Toasts /></Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function Toasts() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root key={t.id} toast={t} className="dl-toast">
      <Icon name={t.type === "error" ? "circle-x" : "check"} />
      <Toast.Title className="dl-toast__title" />
      {t.actionProps && <Toast.Action className="dl-btn dl-btn--ghost dl-btn--sm" />}
    </Toast.Root>
  ));
}

/** What just happened, with the way back: const toast = useToast(); toast("Turned off on mail.google.com", { label: "Undo", onClick: undo }).
 *  A toast with an action stays 10 s, and as long as the pointer or focus is on it; F6 reaches it from the keyboard.
 *  The way back must also live somewhere that stays, such as the row's switch or Activity. */
export function useToast() {
  const manager = Toast.useToastManager();
  return (title: string, action?: { label: string; onClick: () => void }, failed?: boolean) =>
    manager.add({
      title,
      type: failed ? "error" : undefined,
      timeout: action ? 10000 : 6000,
      actionProps: action && { children: action.label, onClick: action.onClick },
    });
}

/** Names an icon button on hover and on focus: <Tip label="Copy link"><IconBtn icon="link" label="Copy link" /></Tip>. */
export function Tip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}><Tooltip.Popup className="dl-tooltip">{label}</Tooltip.Popup></Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export type MenuEntry = { label: string; icon?: IconName; onClick: () => void; hint?: ReactNode; danger?: boolean; disabled?: boolean } | "separator";
/** A row's other actions behind its ellipsis; the one that loses something goes last, after a separator, and opens a Confirm.
 *  <RowMenu label="More for Unread count beside each label" items={[{ label: "Show me on the page", icon: "eye", onClick: show }, "separator",
 *    { label: "Remove…", icon: "trash-2", danger: true, onClick: () => setAsking(true) }]} /> */
export function RowMenu({ label, items }: { label: string; items: MenuEntry[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="dl-icon-btn dl-row__more" aria-label={label}><Icon name="ellipsis" /></Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end">
          <Menu.Popup className="dl-menu">
            {items.map((it, i) =>
              it === "separator" ? (
                <Menu.Separator key={i} className="dl-menu__sep" />
              ) : (
                <Menu.Item key={i} className={cx("dl-menu__item", it.danger && "dl-menu__item--danger")} disabled={it.disabled} onClick={it.onClick}>
                  {it.icon && <Icon name={it.icon} />}{it.label}{it.hint != null && <span className="dl-menu__hint">{it.hint}</span>}
                </Menu.Item>
              ),
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export type PickOption<T extends string> = { value: T; label: string; tone?: "warn" };
/** A value chosen in place, such as what the next ask changes. The list opens over the page with the current one ticked.
 *  <Pick label="What this ask changes" value={kind} onChange={setKind} options={[{ value: "new", label: "New change" }, { value: "edit", label: "Edit this change", tone: "warn" }]} /> */
export function Pick<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: PickOption<T>[] }) {
  const current = options.find((o) => o.value === value);
  return (
    <Select.Root value={value} onValueChange={(v) => { if (v != null) onChange(v); }} items={options}>
      <Select.Trigger className="dl-pick" data-tone={current?.tone} aria-label={label}>
        <span><Select.Value /></span><Icon name="chevron-down" size={12} />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} align="start" alignItemWithTrigger={false}>
          <Select.Popup className="dl-menu">
            {options.map((o) => (
              <Select.Item key={o.value} value={o.value} className="dl-menu__item">
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator className="dl-menu__hint"><Icon name="check" /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

/** Asks one question before a loss. The verb is on the button, Cancel is always there and takes focus first, and Escape works.
 *  <Confirm open={asking} onOpenChange={setAsking} title="Remove “Unread count beside each label”?" action="Remove" onConfirm={remove}>
 *    It stops running on mail.google.com and leaves your list, with its three versions.</Confirm> */
export function Confirm({ open, onOpenChange, title, children, action, onConfirm, busy }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; children: ReactNode; action: string; onConfirm: () => void; busy?: boolean;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="dl-backdrop" />
        <AlertDialog.Viewport className="dl-dialog-viewport">
          <AlertDialog.Popup className="dl-dialog" initialFocus={cancel}>
            <AlertDialog.Title className="dl-dialog__title">{title}</AlertDialog.Title>
            <AlertDialog.Description className="dl-dialog__body">{children}</AlertDialog.Description>
            <div className="dl-dialog__actions">
              <AlertDialog.Close ref={cancel} className="dl-btn dl-btn--secondary">Cancel</AlertDialog.Close>
              <button type="button" className="dl-btn dl-btn--danger-solid" aria-busy={busy || undefined} onClick={busy ? undefined : onConfirm}>
                {busy && <Spinner />}{action}
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/** A task that needs a few fields before it is done, over the page: <Dialog open={o} onOpenChange={setO} title="Rename this change" actions={<>…</>}>{fields}</Dialog>.
 *  For a question before a loss, use Confirm. */
export function Dialog({ open, onOpenChange, title, children, actions }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; children: ReactNode; actions: ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="dl-backdrop" />
        <BaseDialog.Viewport className="dl-dialog-viewport">
          <BaseDialog.Popup className="dl-dialog">
            <BaseDialog.Title className="dl-dialog__title">{title}</BaseDialog.Title>
            {children}
            <div className="dl-dialog__actions">{actions}</div>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
