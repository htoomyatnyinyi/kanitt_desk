import { invoke, isTauri } from "@tauri-apps/api/core";

function stylesheetLinks() {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map((link) => `<link rel="stylesheet" href="${link.href}">`)
    .join("");
  const inlineStyles = Array.from(document.querySelectorAll("style"))
    .map((style) => style.outerHTML)
    .join("");
  return links + inlineStyles;
}

/** Print only supplied markup in a separate document, never the POS page. */
export function printIsolatedHtml(contentHtml: string, printCss: string) {
  const frame = document.createElement("iframe");
  frame.title = "Print preview";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0";
  document.body.appendChild(frame);

  const printDocument = frame.contentDocument;
  const printWindow = frame.contentWindow;
  if (!printDocument || !printWindow) {
    frame.remove();
    return;
  }

  printDocument.open();
  printDocument.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${document.baseURI}">${stylesheetLinks()}<style>${printCss}</style></head><body>${contentHtml}</body></html>`);
  printDocument.close();

  let removed = false;
  let started = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    frame.remove();
  };
  const beginPrint = () => {
    if (started) return;
    started = true;
    printWindow.focus();
    printWindow.print();
    window.setTimeout(cleanup, 30000);
  };
  printWindow.addEventListener("afterprint", cleanup, { once: true });
  printWindow.addEventListener("load", beginPrint, { once: true });
  // Loading stylesheets can lag on slower machines; keep a bounded fallback.
  window.setTimeout(beginPrint, 1500);
}

/** Queue text to the OS default printer in Tauri without opening a dialog. */
export interface SystemPrinter {
  name: string;
  isDefault: boolean;
}

export async function listSystemPrinters(): Promise<SystemPrinter[]> {
  const tauriWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
  if (!isTauri() && !tauriWindow.__TAURI_INTERNALS__) return [];
  return invoke<SystemPrinter[]>("list_printers");
}

export async function printToDefaultPrinter(receiptText: string, printerName?: string) {
  const tauriWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
  if (!isTauri() && !tauriWindow.__TAURI_INTERNALS__) return false;
  await invoke("print_receipt_silently", { receiptText, printerName: printerName || null });
  return true;
}

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);

