import { $, $$ } from './ui.js';

let open = false;
export function openModal(title, html, foot) {
  $('#modaltitle').textContent = title;
  $('#modalbody').innerHTML = html;
  $('#modalfoot').innerHTML = foot || '<button class="btn ghost sm" data-close>Close</button>';
  $$('#modalfoot [data-close]').forEach((b) => (b.onclick = closeModal));
  $('#modalbody').scrollTop = 0;
  $('#modal').classList.add('on'); $('#scrim').classList.add('on'); open = true;
}
export function closeModal() {
  $('#modal').classList.remove('on'); $('#scrim').classList.remove('on'); open = false;
}
export function initModal() {
  $('#scrim').addEventListener('click', closeModal);
  $('#modalx').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closeModal(); });
}
