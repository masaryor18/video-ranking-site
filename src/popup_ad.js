// src/popup_ad.js
// ポップアップ広告の制御モジュール
import { popupAdHtml } from './popup_ad_content.js';

/**
 * ポップアップ広告を一定時間後に表示する
 * @param {number} delayMs 表示までの待機時間（ミリ秒）
 */
export function showPopupAd(delayMs = 3000) {
  setTimeout(() => {
    const popup = document.getElementById('popup-ad');
    if (!popup) return;

    const slot = document.getElementById('popup-ad-slot');
    if (slot) {
      slot.innerHTML = popupAdHtml; // ← 広告を挿入！
    }

    popup.style.display = 'flex';
    popup.setAttribute('aria-hidden', 'false');

    const closeBtn = popup.querySelector('.close-ad');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        popup.setAttribute('aria-hidden', 'true');
      });
    }
  }, delayMs);
}

/**
 * ポップアップ広告を即座に非表示にする
 */
export function hidePopupAd() {
  const popup = document.getElementById('popup-ad');
  if (!popup) return;
  popup.style.display = 'none';
  popup.setAttribute('aria-hidden', 'true');
}
