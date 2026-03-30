import { toPng } from "html-to-image";

export async function exportElementAsPng(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: getComputedStyle(element).getPropertyValue("--bg-page").trim() || "#0c0a09",
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
