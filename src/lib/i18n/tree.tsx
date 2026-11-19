import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/dict";
import { applyTranslation, needsTranslation, translateMany } from "@/lib/i18n/auto";

const TEXT_PROPS = ["placeholder", "title", "alt", "aria-label"] as const;

function collect(node: ReactNode, out: Set<string>) {
  if (typeof node === "string") {
    if (needsTranslation(node)) out.add(node.trim());
    return;
  }
  if (Array.isArray(node)) {
    for (const n of node) collect(n, out);
    return;
  }
  if (!isValidElement(node)) return;
  const props = node.props as Record<string, unknown>;
  for (const key of TEXT_PROPS) {
    const v = props[key];
    if (typeof v === "string" && needsTranslation(v)) out.add(v.trim());
  }
  collect(props.children as ReactNode, out);
}

function apply(node: ReactNode, map: Map<string, string>): ReactNode {
  if (typeof node === "string") return applyTranslation(node, map);
  if (Array.isArray(node)) return node.map((n) => apply(n, map));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<Record<string, unknown>>;
  const next: Record<string, unknown> = {};
  for (const key of TEXT_PROPS) {
    const v = el.props[key];
    if (typeof v === "string" && needsTranslation(v)) next[key] = applyTranslation(v, map);
  }
  const children = el.props.children as ReactNode;
  if (children === undefined || children === null) {
    return Object.keys(next).length ? cloneElement(el, next) : el;
  }
  const mapped = Children.map(children, (child) => apply(child, map));
  return cloneElement(el, next, ...(mapped ?? []));
}

export async function localizeTree(node: ReactNode, locale: Locale): Promise<ReactNode> {
  if (locale === "bg") return node;
  const strings = new Set<string>();
  collect(node, strings);
  if (strings.size === 0) return node;
  const map = await translateMany([...strings]);
  return apply(node, map);
}
