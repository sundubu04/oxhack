// React components over kit.css, so a screen gets the house type, rows, status marks and controls instead of its own CSS.
// Pieces that open over the page (menus, value pickers, dialogs, tooltips, toasts) are in overlays.tsx, on Base UI.
import { createElement, useEffect, useId, useRef, useState, type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import ICONS from "./icons.json";

export type Tone = "ok" | "warn" | "stop" | "info" | "accent";
type StateTone = Exclude<Tone, "accent">;

/** cx("dl-btn", busy && "is-busy", undefined) -> "dl-btn" */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type IconName = keyof typeof ICONS;
/** A Lucide line icon in currentColor: <Icon name="settings" /> is 16px; 12 sits in a meta line, 20 in a phone bar. Never emoji.
 *  With a label it is announced as an image; without one it is decoration beside a word. */
export function Icon({ name, size = 16, label }: { name: IconName; size?: 12 | 14 | 16 | 20 | 24; label?: string }) {
  return (
    <svg className="dl-icon" viewBox="0 0 24 24" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {(ICONS[name] as [string, Record<string, string>][]).map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

/** Text a screen reader says and the eye doesn't need: <Sr>Done</Sr>. */
export const Sr = ({ children }: { children: ReactNode }) => <span className="dl-sr">{children}</span>;

/** The console's frame: the rail beside the page, and under 720px a top bar whose button opens the rail as a drawer.
 *  <AppFrame title="Changes" brand={<Avatar name="App" brand />} rail={<a className="dl-nav__item" aria-current="page" href="/app">…</a>}>{page}</AppFrame> */
export function AppFrame({ title, brand, rail, children }: { title: ReactNode; brand?: ReactNode; rail: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null), menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    railRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const close = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); menuRef.current?.focus(); } };
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, [open]);
  return (
    <div className="dl-app" data-nav-open={open || undefined}>
      <SkipLink />
      <header className="dl-topbar">
        {brand ?? <span />}<span className="dl-topbar__title">{title}</span>
        <IconBtn ref={menuRef} icon="panel-left" label="Menu" aria-expanded={open} aria-controls="dl-rail" onClick={() => setOpen(!open)} />
      </header>
      <nav ref={railRef} className="dl-rail" id="dl-rail" aria-label="Console" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>{rail}</nav>
      <button className="dl-scrim" type="button" aria-label="Close the menu" tabIndex={-1} onClick={() => setOpen(false)} />
      <main className="dl-main" id="main">{children}</main>
    </div>
  );
}

/** The first thing a keyboard reaches, so it can pass the rail: <SkipLink href="#main" /> before the rail, id="main" on the content. */
export const SkipLink = ({ href = "#main" }: { href?: string }) => <a className="dl-skip" href={href}>Skip to content</a>;

type BtnKind = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
/** The classes for a link that looks like a button: <a className={btn("secondary")} href="/changes">Changes</a>. */
export const btn = (kind: BtnKind = "secondary", sm?: boolean) => cx("dl-btn", `dl-btn--${kind}`, sm && "dl-btn--sm");

/** <Btn kind="primary" onClick={keep}>Keep</Btn>. One primary per card or screen; danger-solid only confirms a loss inside a dialog.
 *  busy keeps the label, adds a spinner and takes no more presses: <Btn kind="primary" busy>Keep</Btn>. */
export function Btn({ kind = "secondary", sm, busy, icon, className, onClick, children, ...rest }: {
  kind?: BtnKind; sm?: boolean; busy?: boolean; icon?: IconName; children: ReactNode;
} & ComponentProps<"button">) {
  return (
    <button type="button" {...rest} className={cx(btn(kind, sm), className)} aria-busy={busy || undefined}
      aria-disabled={busy || rest["aria-disabled"] || undefined} onClick={busy ? undefined : onClick}>
      {busy ? <Spinner /> : icon && <Icon name={icon} />}{children}
    </button>
  );
}

/** A square button with only an icon. label is what a screen reader says; wrap it in <Tip> from overlays.tsx so everyone can read it.
 *  <IconBtn icon="ellipsis" label="More for Unread count beside each label" /> */
export function IconBtn({ icon, label, busy, className, ...rest }: { icon: IconName; label: string; busy?: boolean } & ComponentProps<"button">) {
  return (
    <button type="button" {...rest} className={cx("dl-icon-btn", className)} aria-label={label} aria-busy={busy || undefined}>
      {busy ? <Spinner /> : <Icon name={icon} />}
    </button>
  );
}

/** The one thing that turns, only while something runs. With a label it is announced; inside a busy button it is decoration. */
export function Spinner({ label }: { label?: string }) {
  return <span className="dl-spinner" role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

type FieldWiring = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };
/** A label above its control, an optional hint, and an error sentence under it, all wired by id.
 *  <Field label="Send it to" error={bad ? "That address has no @ in it." : undefined}>{(p) => <Input {...p} value={v} onChange={…} />}</Field> */
export function Field({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: (wiring: FieldWiring) => ReactNode }) {
  const id = useId();
  const describedBy = cx(hint != null && `${id}-hint`, error != null && `${id}-error`) || undefined;
  return (
    <div className="dl-field">
      <label className="dl-label" htmlFor={id}>{label}</label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error != null ? true : undefined })}
      {hint != null && <p className="dl-hint" id={`${id}-hint`}>{hint}</p>}
      {error != null && <p className="dl-error" id={`${id}-error`}><Icon name="circle-alert" size={12} />{error}</p>}
    </div>
  );
}

export const Input = ({ className, ...p }: ComponentProps<"input">) => <input className={cx("dl-input", className)} {...p} />;
export const Textarea = ({ className, ...p }: ComponentProps<"textarea">) => <textarea className={cx("dl-input dl-textarea", className)} {...p} />;

/** A native select with the kit's chevron, for a form. A value picker that opens a list in place is Pick in overlays.tsx.
 *  <NativeSelect value={side} onChange={…}><option>Right</option><option>Left</option></NativeSelect> */
export function NativeSelect({ className, children, ...p }: ComponentProps<"select">) {
  return <span className="dl-select"><select className={cx("dl-input", className)} {...p}>{children}</select><Icon name="chevron-down" /></span>;
}

/** A preference that waits for Save: <Check checked={weekly} onChange={(e) => setWeekly(e.target.checked)}>A summary every Monday</Check>.
 *  mixed draws the dash that means "some of these". */
export function Check({ mixed, children, className, ...p }: { mixed?: boolean; children: ReactNode } & Omit<ComponentProps<"input">, "type" | "ref">) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!mixed; }, [mixed]);
  return <label className="dl-choice"><input ref={ref} type="checkbox" className={cx("dl-check", className)} {...p} /><span>{children}</span></label>;
}

/** One of a few choices that all fit on screen, inside a Fieldset: <Radio name="open" value="tab" checked={…} onChange={…}>The tab on the page's edge</Radio> */
export function Radio({ children, className, ...p }: { children: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  return <label className="dl-choice"><input type="radio" className={cx("dl-radio", className)} {...p} /><span>{children}</span></label>;
}
export function Fieldset({ legend, children }: { legend: ReactNode; children: ReactNode }) {
  return <fieldset className="dl-fieldset"><legend className="dl-label">{legend}</legend>{children}</fieldset>;
}

/** Something that takes effect at once. Its name is what it controls, never "On":
 *  <Switch checked={on} onChange={save} label="Unread count beside each label" />. pending holds it still while the write is in flight. */
export function Switch({ checked, onChange, pending, disabled, ...name }: {
  checked: boolean; onChange: (next: boolean) => void; pending?: boolean; disabled?: boolean;
} & ({ label: string } | { labelledBy: string })) {
  return (
    <button type="button" role="switch" className="dl-switch" aria-checked={checked} disabled={disabled} aria-busy={pending || undefined}
      aria-label={"label" in name ? name.label : undefined} aria-labelledby={"labelledBy" in name ? name.labelledBy : undefined}
      onClick={() => { if (!pending) onChange(!checked); }} />
  );
}

const ARROWS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
/** Index after an arrow, Home or End key over n items, or null for any other key: nextIndex("ArrowLeft", 0, 3) -> 2 */
function nextIndex(key: string, i: number, n: number) {
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  return key in ARROWS ? (i + ARROWS[key]! + n) % n : null;
}

/** Two to four views of the same thing, one at a time: <Seg label="Show" options={["All", "On", "Off"]} value={view} onChange={setView} />.
 *  A radio group: Tab reaches the chosen option and the arrow keys move the choice. */
export function Seg<T extends string>({ options, value, onChange, label }: {
  options: readonly (T | { value: T; label: ReactNode })[]; value: T; onChange: (v: T) => void; label: string;
}) {
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o as ReactNode } : o));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const key = (e: KeyboardEvent, i: number) => {
    const j = nextIndex(e.key, i, items.length);
    if (j == null) return;
    e.preventDefault();
    onChange(items[j]!.value);
    refs.current[j]?.focus();
  };
  return (
    <div className="dl-seg" role="radiogroup" aria-label={label}>
      {items.map((o, i) => (
        <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1} onClick={() => onChange(o.value)} onKeyDown={(e) => key(e, i)}>{o.label}</button>
      ))}
    </div>
  );
}

export type Tab = { id: string; label: ReactNode; count?: number; panel: ReactNode };
/** Pages of one object switched in place: <Tabs label="This change" tabs={[{ id: "overview", label: "Overview", panel: <Overview /> }, …]} />.
 *  Arrow keys move between tabs. Tabs that change the URL are links with aria-current="page" in <nav className="dl-tabs"> instead. */
export function Tabs({ label, tabs, value, onChange }: { label: string; tabs: Tab[]; value?: string; onChange?: (id: string) => void }) {
  const base = useId();
  const [own, setOwn] = useState(tabs[0]?.id);
  const current = value ?? own;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const pick = (id: string) => { setOwn(id); onChange?.(id); };
  const key = (e: KeyboardEvent, i: number) => {
    const j = nextIndex(e.key, i, tabs.length);
    if (j == null) return;
    e.preventDefault();
    pick(tabs[j]!.id);
    refs.current[j]?.focus();
  };
  return (
    <div className="dl-stack">
      <div className="dl-tabs" role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[i] = el; }} id={`${base}-${t.id}`} className="dl-tabs__item" type="button" role="tab"
            aria-selected={t.id === current} aria-controls={`${base}-${t.id}-panel`} tabIndex={t.id === current ? 0 : -1}
            onClick={() => pick(t.id)} onKeyDown={(e) => key(e, i)}>
            {t.label}{t.count != null && <span className="dl-tabs__count">{t.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`${base}-${t.id}-panel`} role="tabpanel" aria-labelledby={`${base}-${t.id}`} tabIndex={0} hidden={t.id !== current}>{t.panel}</div>
      ))}
    </div>
  );
}

/** A section's heading: its name in sentence case on the left, one control on the right. <Head label="Today" level={3}><Btn sm kind="ghost">Week</Btn></Head> */
export function Head({ label, level = 3, children }: { label: ReactNode; level?: 2 | 3 | 4; children?: ReactNode }) {
  const H = `h${level}` as const;
  return <div className="dl-card__head"><H className="dl-kicker">{label}</H>{children}</div>;
}

/** <Stats><Stat value="3" label="kept this week" tone="accent" hero /><Stat value="69 s" label="median build" /></Stats> */
export function Stats({ children }: { children: ReactNode }) {
  return <div className="dl-stats">{children}</div>;
}
export function Stat({ value, label, tone, hero }: { value: ReactNode; label: ReactNode; tone?: Tone; hero?: boolean }) {
  return (
    <div className={cx("dl-stat", hero && "dl-stat--hero")} data-tone={tone}>
      <span className="dl-stat__n">{value}</span><span className="dl-stat__l">{label}</span>
    </div>
  );
}

/** The one row grammar, in a <Rows> list: a lead (status mark or picture), a title, a second line that says why the row is here, and its actions.
 *  To open something from the row, put a link or a button with className="dl-row__link" in the title: it covers the row and the actions stay above it.
 *  <Row title={<a className="dl-row__link" href="/changes/unread" aria-current="page">Unread count beside each label</a>} sub="Inbox · kept 20 Oct" action={<Switch …/>} current /> */
export function Rows({ label, children }: { label?: string; children: ReactNode }) {
  return <ul className="dl-list" aria-label={label}>{children}</ul>;
}
export function Row({ lead, title, sub, action, current, off }: {
  lead?: ReactNode; title: ReactNode; sub?: ReactNode; action?: ReactNode; current?: boolean; off?: boolean;
}) {
  return (
    <li className={cx("dl-row", lead == null && "dl-row--plain")} data-current={current || undefined} data-off={off || undefined}>
      {lead != null && <span className="dl-row__lead">{lead}</span>}
      <div className="dl-row__text"><p className="dl-row__title">{title}</p>{sub != null && <p className="dl-row__sub">{sub}</p>}</div>
      {action != null ? <div className="dl-row__action">{action}</div> : <span />}
    </li>
  );
}

export type Mark = "dot" | "ring" | "ring-dashed" | "half" | "diamond" | "square" | "triangle" | "dash";
/** A mark and a word, never colour alone: <Status tone="warn">Needs you</Status>. Where only the mark fits, the word is read, not shown:
 *  <Status tone="ok" label="Kept" />. Default marks: none = dash, ok = dot, info = ring, warn = half, stop = diamond. */
export function Status({ tone, mark, ...words }: { tone?: StateTone; mark?: Mark } & ({ children: ReactNode } | { label: string })) {
  return (
    <span className="dl-status" data-tone={tone} data-mark={mark}>
      {"children" in words ? words.children : <Sr>{words.label}</Sr>}
    </span>
  );
}

/** A small fixed label in sentence case: <Tag tone="info">Preview</Tag>. */
export function Tag({ tone, children }: { tone?: StateTone; children: ReactNode }) {
  return <span className="dl-tag" data-tone={tone}>{children}</span>;
}

/** A key to press: <Kbd>K</Kbd>. Single-key shortcuts need a setting that turns them off. */
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="dl-kbd">{children}</kbd>;

const BANNER_ICON: Record<StateTone, IconName> = { info: "info", ok: "circle-check", warn: "triangle-alert", stop: "circle-x" };
/** A notice at the top of what it is about, until its cause is gone:
 *  <Banner tone="warn" action={<Btn sm>Allow in Chrome</Btn>}>The upload stopped at 40%. Your file is still on your computer.</Banner> */
export function Banner({ tone = "info", action, children }: { tone?: StateTone; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="dl-banner" data-tone={tone} role={tone === "stop" ? "alert" : "status"}>
      <Icon name={BANNER_ICON[tone]} /><p>{children}</p>{action}
    </div>
  );
}

/** What would be here and the one step that fills it: <Empty title="No changes on this site yet" action={…}>Open the panel and ask for one.</Empty> */
export function Empty({ title, action, children }: { title: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return <div className="dl-empty"><span className="dl-empty__title">{title}</span>{children != null && <span>{children}</span>}{action}</div>;
}

/** A still shape where a row will load, so the page doesn't jump: <Skeleton width="70%" /> or <Skeleton width={72} height={48} />. */
export function Skeleton({ width, height = 12 }: { width: number | string; height?: number }) {
  return <span className="dl-skeleton" aria-hidden="true" style={{ width, height }} />;
}

/** Keys and values: <KV items={[["Site", "mail.google.com"], ["State", <Status tone="ok">On</Status>]]} /> */
export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return <dl className="dl-kv">{items.map(([k, v], i) => [<dt key={`k${i}`}>{k}</dt>, <dd key={`v${i}`}>{v}</dd>])}</dl>;
}

/** Initials in a circle, beside the name they stand for: <Avatar name="Mei Tanaka" /> -> "MT". brand is Darling's own voice, in pink. */
export function Avatar({ name, brand, lg }: { name: string; brand?: boolean; lg?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]!.toUpperCase()).join("");
  return <span className={cx("dl-avatar", brand && "dl-avatar--brand", lg && "dl-avatar--lg")} aria-hidden="true">{initials}</span>;
}

/** How full something with a limit is: <Meter label="Storage used" value={1.9} max={3} valueText="1.9 of 3 GB" />. The words are read; the bar is seen. */
export function Meter({ value, max = 1, tone, label, valueText }: { value: number; max?: number; tone?: Tone; label: string; valueText?: string }) {
  const v = Math.max(0, Math.min(max, value));
  return (
    <div className="dl-meter" data-tone={tone} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={v}
      aria-valuetext={valueText} style={{ "--dl-p": max ? v / max : 0 } as CSSProperties} />
  );
}

/** How far a task has got, 0 to 1: <Progress label="Building a preview" value={0.45} />. */
export function Progress({ value, label, tone }: { value: number; label: string; tone?: Tone }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="dl-meter" data-tone={tone} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)} style={{ "--dl-p": v } as CSSProperties} />
  );
}

export type RunState = "running" | "stopped" | "failed" | "lost" | "ready";
export type Step = { label: ReactNode; state: "done" | "now" | "next"; time?: ReactNode };
const RUN_WORD: Record<RunState, string> = { running: "running", stopped: "stopped", failed: "failed", lost: "connection lost, retrying", ready: "ready" };
const STEP_WORD: Record<Step["state"], string> = { done: "done", now: "in progress", next: "to do" };
/** Work with named steps: the steps with their state in words, the time so far, and a bar that moves with real progress.
 *  A change of state is announced; the clock is not. lost is a dropped connection, so the mark stops turning.
 *  <Steps title="Building a preview" state="running" elapsed="0:41" progress={0.45} steps={[{ label: "Read the page", state: "done", time: "4 s" }, …]} /> */
export function Steps({ title, state, elapsed, progress, steps, foot }: {
  title: string; state: RunState; elapsed?: ReactNode; progress: number; steps: Step[]; foot?: ReactNode;
}) {
  return (
    <section className="dl-steps" data-state={state} aria-label={title}>
      <div className="dl-steps__head"><span className="dl-kicker">{title}</span><span className="dl-meta" aria-hidden="true">{elapsed}</span></div>
      <p className="dl-sr" role="status">{`${title}, ${RUN_WORD[state]}`}</p>
      <ol className="dl-steps__list">
        {steps.map((s, i) => (
          <li key={i} className="dl-step" data-state={s.state}>{s.label}<Sr>{`, ${STEP_WORD[s.state]}`}</Sr><span className="dl-step__time">{s.time}</span></li>
        ))}
      </ol>
      <div className="dl-steps__bar" aria-hidden="true"><div className="dl-steps__fill" style={{ "--dl-p": progress } as CSSProperties} /></div>
      {foot != null && <div className="dl-steps__foot">{foot}</div>}
    </section>
  );
}

/** A conversation, newest last; a screen reader hears each new message once: <Thread label="Your ask"><p className="dl-msg dl-msg--user">…</p></Thread> */
export function Thread({ label, children }: { label: string; children: ReactNode }) {
  return <div className="dl-thread" role="log" aria-label={label}>{children}</div>;
}

/** The ask box. Enter sends and Shift+Enter breaks the line; an Enter that confirms Korean or Japanese input is left to the input method.
 *  <Composer value={text} onChange={setText} onSend={send} placeholder="Ask for a change on this page">{pickers}</Composer> */
export function Composer({ value, onChange, onSend, placeholder, busy, children }: {
  value: string; onChange: (v: string) => void; onSend: () => void; placeholder: string; busy?: boolean; children?: ReactNode;
}) {
  const ready = value.trim() !== "" && !busy;
  return (
    <form className="dl-composer" aria-busy={busy || undefined} onSubmit={(e) => { e.preventDefault(); if (ready) onSend(); }}>
      <textarea className="dl-composer__input" rows={1} value={value} placeholder={placeholder} aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }} />
      <div className="dl-composer__bar">
        <div className="dl-composer__context">{children}</div>
        <button className="dl-send" type="submit" aria-label="Send" disabled={!ready}><Icon name="arrow-up" /></button>
      </div>
    </form>
  );
}

export type Block = { from: Date; to: Date; label?: string; tone?: Tone; free?: boolean };
/** A span of time with blocks, a now line and ticks on round local times; the blocks are also a list a screen reader can read.
 *  <Timeline label="Today" from={nine} to={seven} now={new Date()} blocks={[{ from, to, label: "Standup" }, { from, to, free: true }]} /> */
export function Timeline({ label, from, to, now, blocks, ticks = 6 }: { label: string; from: Date; to: Date; now?: Date; blocks: Block[]; ticks?: number }) {
  const span = to.getTime() - from.getTime() || 1;
  const at = (d: Date) => Math.max(0, Math.min(1, (d.getTime() - from.getTime()) / span));
  const stepMin = [15, 30, 60, 120, 180, 240, 360, 720].find((m) => span / (m * 60e3) <= ticks) ?? Math.ceil(span / 60e3);
  const first = new Date(from);
  first.setSeconds(0, 0);
  first.setHours(0, Math.ceil((from.getHours() * 60 + from.getMinutes() + from.getSeconds() / 60) / stepMin) * stepMin);
  const marks: Date[] = [];
  for (let t = first.getTime(); t <= to.getTime(); t += stepMin * 60e3) marks.push(new Date(t));
  return (
    <div>
      <div className="dl-timeline" aria-hidden="true">
        {blocks.map((b, i) => (
          <span key={i} className="dl-timeline__block" data-tone={b.tone} data-free={b.free ? "" : undefined} style={{ "--a": at(b.from), "--b": at(b.to) } as CSSProperties} />
        ))}
        {now && now >= from && now <= to && <span className="dl-timeline__now" style={{ "--now": at(now) } as CSSProperties} />}
      </div>
      <div className="dl-timeline__ticks" aria-hidden="true">{marks.map((m) => <span key={m.getTime()} style={{ "--t": at(m) } as CSSProperties}>{hm(m)}</span>)}</div>
      <ul className="dl-sr" aria-label={`${label}, ${hm(from)} to ${hm(to)}`}>
        {blocks.map((b, i) => <li key={i}>{`${b.label ?? (b.free ? "Free" : "Busy")}, ${hm(b.from)} to ${hm(b.to)}`}</li>)}
      </ul>
    </div>
  );
}

/** A trend beside the number it explains: <Spark values={[3, 5, 2, 8]} tone="ok" />. Decoration: the number beside it carries the meaning. */
export function Spark({ values, tone }: { values: number[]; tone?: Tone }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values), k = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - lo) / k) * 28}`).join(" ");
  return (
    <svg className="dl-spark" data-tone={tone} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
/** hm(new Date("2026-10-21T09:30")) -> "09:30" (24-hour, the viewer's zone). */
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** dur(95 * 60e3) -> "1 h 35 min"; dur(40e3) -> "under a minute". */
export function dur(ms: number) {
  const m = Math.round(Math.abs(ms) / 60e3);
  if (m < 1) return "under a minute";
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${m} min`;
}
/** rel(start, now) -> "in 12 min", "now", "3 h ago", "in 2 d"; 59.6 minutes reads "1 h", never "60 min". */
export function rel(d: Date, now: Date) {
  const ms = d.getTime() - now.getTime(), m = Math.round(Math.abs(ms) / 60e3);
  if (m < 1) return "now";
  const h = Math.round(m / 60), days = Math.round(m / 1440);
  const s = m < 60 ? `${m} min` : h < 24 ? `${h} h` : `${days} d`;
  return ms > 0 ? `in ${s}` : `${s} ago`;
}
