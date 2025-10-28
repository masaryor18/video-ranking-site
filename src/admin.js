// src/admin.js
import { createClient } from '@supabase/supabase-js'

// Supabase環境変数の読み込み
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD  // ← 安全に.envから読み込み

// Supabaseクライアント作成
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// --------------------
// ログイン処理（連続5回ミスで1時間ロック）
// --------------------
document.getElementById('login-btn').addEventListener('click', () => {
  const input = document.getElementById('admin-password').value
  const error = document.getElementById('login-error')

  const now = Date.now()
  const lockUntil = localStorage.getItem('lockUntil')
  let attempts = parseInt(localStorage.getItem('attempts') || '0')
  let lastAttempt = parseInt(localStorage.getItem('lastAttempt') || '0')

  // --- ロック中チェック ---
  if (lockUntil && now < parseInt(lockUntil)) {
    const minutes = Math.ceil((parseInt(lockUntil) - now) / 60000)
    error.textContent = `ロック中です。${minutes}分後に再試行できます。`
    error.style.display = 'block'
    return
  }

  // --- 10分以上空いたら試行カウントリセット ---
  if (now - lastAttempt > 10 * 60 * 1000) {
    attempts = 0
  }

  // --- パスワード確認 ---
  if (input === ADMIN_PASSWORD) {
    // ✅ 成功 → カウントリセット
    localStorage.removeItem('attempts')
    localStorage.removeItem('lockUntil')
    localStorage.removeItem('lastAttempt')
    error.style.display = 'none'
    document.getElementById('login-section').style.display = 'none'
    document.getElementById('admin-section').style.display = 'block'
    loadVideos()
  } else {
    // ❌ 間違えた場合
    attempts++
    localStorage.setItem('attempts', attempts)
    localStorage.setItem('lastAttempt', now)

    if (attempts >= 5) {
      // 🚫 連続5回失敗 → ロック
      const lockTime = now + 60 * 60 * 1000 // 1時間ロック
      localStorage.setItem('lockUntil', lockTime)
      localStorage.setItem('attempts', 0)
      error.textContent = '5回連続で間違えたため、1時間ロックされました。'
    } else {
      const remaining = 5 - attempts
      error.textContent = `パスワードが違います（あと${remaining}回でロック）`
    }

    error.style.display = 'block'
  }
})

// --------------------
// 動画アップロード処理
// --------------------
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault()

  const title = document.getElementById('title').value
  const link_url = document.getElementById('link_url').value
  const file = document.getElementById('thumbnail').files[0]

  if (!file) return alert('画像を選択してください')

  try {
    // Storageにアップロード
    const fileName = `${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // 公開URLを取得
    const { data: { publicUrl } } = supabase
      .storage
      .from('thumbnails')
      .getPublicUrl(fileName)

    // videosテーブルに登録
    const { error: insertError } = await supabase.from('videos').insert({
      title,
      link_url,
      thumbnail_url: publicUrl,
      created_at: new Date().toISOString()
    })

    if (insertError) throw insertError

    alert('登録が完了しました！')
    e.target.reset()
    loadVideos()
  } catch (err) {
    console.error(err)
    alert('アップロードに失敗しました')
  }
})

// --------------------
// 登録済み動画一覧表示（ページネーション付き）
// --------------------
let currentPage = 1
const perPage = 20
let allVideos = []
let currentSort = 'latest'

async function loadVideos() {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order(currentSort === 'popular' ? 'views' : 'created_at', { ascending: false })

  const list = document.getElementById('video-list')
  list.innerHTML = ''

  if (error || !data || data.length === 0) {
    list.textContent = '登録された動画はありません。'
    return
  }

  allVideos = data
  renderVideos()
}

function renderVideos() {
  const list = document.getElementById('video-list')
  list.innerHTML = ''

  const start = (currentPage - 1) * perPage
  const end = start + perPage
  const pageData = allVideos.slice(start, end)

  pageData.forEach(v => {
    const div = document.createElement('div')
    div.classList.add('video-item')
    div.innerHTML = `
      <div class="video">
        <img src="${v.thumbnail_url}" alt="thumb">
        <div style="flex:1;text-align:left;">
          <div class="video-title">${v.title}</div>
          <a href="${v.link_url}" target="_blank">${v.link_url}</a>
        </div>
        <button data-id="${v.id}" class="delete-btn">削除</button>
      </div>
    `
    list.appendChild(div)
  })

  // ページネーション
  const pagination = document.getElementById('pagination')
  if (pagination) pagination.remove()
  const pagDiv = document.createElement('div')
  pagDiv.id = 'pagination'
  pagDiv.classList.add('pagination')
  pagDiv.innerHTML = `
    <button id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>前へ</button>
    <span>${currentPage}</span>
    <button id="next-page" ${end >= allVideos.length ? 'disabled' : ''}>次へ</button>
  `
  list.after(pagDiv)

  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderVideos() }
  })
  document.getElementById('next-page').addEventListener('click', () => {
    if (end < allVideos.length) { currentPage++; renderVideos() }
  })

  // 削除ボタン
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('本当に削除しますか？')) {
        const { error } = await supabase.from('videos').delete().eq('id', btn.dataset.id)
        if (error) {
          alert('削除に失敗しました')
        } else {
          alert('削除しました')
          loadVideos()
        }
      }
    })
  })
}

// 並び替えボタン
document.getElementById('sort-popular').addEventListener('click', () => {
  currentSort = 'popular'
  currentPage = 1
  loadVideos()
})
document.getElementById('sort-latest').addEventListener('click', () => {
  currentSort = 'latest'
  currentPage = 1
  loadVideos()
})
