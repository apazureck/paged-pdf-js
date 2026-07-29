export function replaceRenderHost(
  container: HTMLElement,
  token: number
): HTMLElement {
  const host = container.ownerDocument.createElement("div");
  host.className = "paged-render-host";
  host.dataset.renderToken = String(token);
  container.replaceChildren(host);
  return host;
}
