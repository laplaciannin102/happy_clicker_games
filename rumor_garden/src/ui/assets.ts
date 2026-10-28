export function assetImage(id: string, className = '', eager = false): HTMLImageElement {
  const image = document.createElement('img');
  image.src = `${import.meta.env.BASE_URL}assets/${id}.png`;
  image.alt = ''; image.className = className; image.decoding = 'async';
  image.loading = eager ? 'eager' : 'lazy'; image.width = image.height = id === 'noticeboard' || id === 'tale' ? 512 : 128;
  image.addEventListener('error', () => { image.hidden = true; }, { once: true });
  return image;
}
export function artwork(id: string, className = '', fallback = '✉', eager = false): HTMLElement {
  const wrapper = document.createElement('span'); wrapper.className = `artwork ${className}`; wrapper.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span'); text.className = 'art-fallback'; text.textContent = fallback;
  wrapper.append(assetImage(id, '', eager), text); return wrapper;
}
