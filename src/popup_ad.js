// src/popup_ad.js

export function showPopupAd(delayMs = 3000) {

  setTimeout(() => {
    const popup = document.getElementById('popup-ad');
    if (!popup) return;

    // 表示
    popup.style.display = 'flex';
    popup.setAttribute('aria-hidden', 'false');

    // ✨ JuicyAds Popup を動的にロード
    const slot = document.querySelector('#popup-ad-slot');
    if (slot) {
      const zoneId = slot.getAttribute('data-adzone');

      // JuicyAds の広告呼び出し
      (window.adsbyjuicy = window.adsbyjuicy || []).push({
        'adzone': parseInt(zoneId)
      });
    }

    // 閉じるボタン
    const closeBtn = popup.querySelector('.close-ad');
    if (closeBtn) {
      closeBtn.onclick = () => {
        popup.style.display = 'none';
        popup.setAttribute('aria-hidden', 'true');
      };
    }

  }, delayMs);
}
