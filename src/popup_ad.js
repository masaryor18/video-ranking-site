// src/popup_ad.js
// JuicyAds ポップアップ広告制御

const POP_ADZONE = 1105825;      // 👈 もらった adzone ID
const POP_WIDTH = 300;
const POP_HEIGHT = 262;

/**
 * JuicyAds のローダースクリプトを 1 回だけ読み込む
 */
function ensureJuicyLoader () {
  // すでに読み込まれていたら何もしない
  if (document.querySelector('script[data-juicy-loader="1"]')) return;

  const s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.setAttribute('data-cfasync', 'false');
  s.setAttribute('data-juicy-loader', '1');
  s.src = 'https://poweredby.jads.co/js/jads.js';
  document.head.appendChild(s);
}

/**
 * 一定時間後にポップアップ広告を表示
 * @param {number} delayMs 表示までの待機時間（ミリ秒）
 */
export function showPopupAd (delayMs = 3000) {
  setTimeout(() => {
    const popup = document.getElementById('popup-ad');
    if (!popup) return;

    const slot = document.getElementById('popup-ad-slot');
    if (!slot) return;

    // ① ins タグを毎回作り直す
    slot.innerHTML = '';
    const ins = document.createElement('ins');
    ins.id = String(POP_ADZONE);
    ins.setAttribute('data-width', String(POP_WIDTH));
    ins.setAttribute('data-height', String(POP_HEIGHT));
    slot.appendChild(ins);

    // ② JuicyAds ローダーを用意
    ensureJuicyLoader();

    // ③ キューに adzone を積む（ローダー読み込み後に処理される）
    (window.adsbyjuicy = window.adsbyjuicy || []).push({ adzone: POP_ADZONE });

    // ④ ポップアップ表示
    popup.style.display = 'flex';
    popup.setAttribute('aria-hidden', 'false');

    // 閉じるボタンのイベント（多重登録防止）
    const closeBtn = popup.querySelector('.close-ad');
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.addEventListener('click', () => {
        hidePopupAd();
      });
      closeBtn.dataset.bound = '1';
    }
  }, delayMs);
}

/**
 * ポップアップ広告を即座に非表示にする
 */
export function hidePopupAd () {
  const popup = document.getElementById('popup-ad');
  if (!popup) return;
  popup.style.display = 'none';
  popup.setAttribute('aria-hidden', 'true');
}
