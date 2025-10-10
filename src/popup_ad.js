// src/popup_ad.js
// ポップアップ広告の制御モジュール

/**
 * ポップアップ広告を一定時間後に表示する
 * @param {number} delayMs 表示までの待機時間（ミリ秒）
 */
export function showPopupAd(delayMs = 3000) {
  setTimeout(() => {
    const popup = document.getElementById('popup-ad');
    if (!popup) return; // HTMLに存在しない場合は何もしない

    popup.style.display = 'flex';
    popup.setAttribute('aria-hidden', 'false');

    // 閉じるボタン処理
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
