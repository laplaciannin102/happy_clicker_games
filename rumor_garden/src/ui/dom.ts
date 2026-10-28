export function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}
export function updateText(element: HTMLElement, text: string) {
  if (element.textContent !== text) element.textContent = text;
}
export function setHidden(element: HTMLElement, hidden: boolean) {
  if (element.hidden !== hidden) element.hidden = hidden;
}
