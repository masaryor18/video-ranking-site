// src/popup_ad.js
import { popupAdHtml } from './popup_ad_content.js';

export function showPopupAd(delayMs = 3000) {
  setTimeout(() => {
    const popup = document.getElementById('popup-ad');
    if (!popup) return;

    const slot = document.getElementById('popup-ad-slot');
    if (slot) {
      slot.innerHTML = popupAdHtml; // ← JuicyAdsコードを挿入
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

export function hidePopupAd() {
  const popup = document.getElementById('popup-ad');
  if (!popup) return;

  popup.style.display = 'none';
  popup.setAttribute('aria-hidden', 'true');
}
