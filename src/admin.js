// src/admin.js
import { createClient } from '@supabase/supabase-js'

// Supabase設定
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ==========================
// 🔐 ログイン処理（5回ミス→1時間ロック）
// ==========================
document.getElementById('login-btn').addEventListener('click', () => {
  const input = document.getElementById('admin-password').value
  const error = document.getElementById('login-error')
  const now = Date.now()
  const lockUntil = parseInt(localStorage.getItem('lockUntil') || '0')
  let attempts = parseInt(localStorage.getItem('attempts') || '0')
  let lastAttempt = parseInt(localStorage.getItem('lastAttempt') || '0')

  if (lockUntil && now < lockUntil) {
    const minutes = Math.ceil((lockUntil - now) / 60000)
    error.textContent = `ロック中です。${minutes}分後に再試行可能です。`
    error.style.display = 'block'
    return
  }

  if (now - lastAttempt > 10 * 60 * 1000) attempts = 0

  if (input === ADMIN_PASSWORD) {
    // ✅ ログイン成功
    localStorage.removeItem('attempts')
    localStorage.removeItem('lockUntil')
    localStorage.removeItem('lastAttempt')
    document.getElementById('login-section').style.display = 'none'
    document.getElementById('admin-section').style.display = 'block'
    loadVideos()
  } else {
    // ❌ 間違い
    attempts++
    localStorage.setItem('attempts', attempts)
    localStorage.setItem('lastAttempt', now)

    if (attempts >= 5) {
      const lockTime = now + 60 * 60 * 1000
      localStorage.setItem('lockUntil', lockTime)
      localStorage.setItem('attempts', 0)
      error.textContent = '5回連続で失敗したため、1時間ロックされました。'
    } else {
      error.textContent = `パスワードが違います（あと${5 - attempts}回でロック）`
    }

    error.style.display = 'block'
  }
})

// ==========================
// 🎬 動画登録処理
// ==========================
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault()

  const title = document.getElementById('title').value.trim()
  const link_url = document.getElementById('link_url').value.trim()
  const file = document.getElementById('thumbnail').files[0]
  if (!file) return alert('画像を選択してください')

  try {
    const fileName = `${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('thumbnails').upload(fileName, file)
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
    const { publicUrl } = data

    const { error: insertError } = await supabase.from('videos').insert({
      title,
      link_url,
      thumbnail_url: publicUrl,
      created_at: new Date().toISOString(),
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

// ==========================
// 📺 動画一覧表示＋ソート機能
// ==========================
let currentSort = 'popular'
let currentPage = 1
const perPage = 20
let allVideos = []

async function loadVideos() {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order(currentSort === 'popular' ? 'views' : 'created_at', { ascending: false })

  if (error) {
    console.error(error)
    alert('データ取得に失敗しました')
    return
  }

  allVideos = data || []
  renderVideos()
}

function renderVideos() {
  const list = document.getElementById('video-list')
  list.innerHTML = ''

  const start = (currentPage - 1) * perPage
  const end = start + perPage
  const pageVideos = allVideos.slice(start, end)

  pageVideos.forEach(v => {
    const div = document.createElement('div')
    div.className = 'video-item'
    div.innerHTML = `
      <img src="${v.thumbnail_url}" alt="thumb" />
      <div>
        <strong>${v.title}</strong>
        <a href="${v.link_url}" target="_blank">${v.link_url}</a>
      </div>
      <button class="delete-btn" data-id="${v.id}">削除</button>
    `
    list.appendChild(div)
  })

  // ページネーション
  const pagination = document.createElement('div')
  pagination.className = 'pagination'
  pagination.innerHTML = `
    <button ${currentPage === 1 ? 'disabled' : ''} id="prev-page">前へ</button>
    <span>${currentPage}</span>
    <button ${end >= allVideos.length ? 'disabled' : ''} id="next-page">次へ</button>
  `
  list.after(pagination)

  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderVideos() }
  })
  document.getElementById('next-page').addEventListener('click', () => {
    if (end < allVideos.length) { currentPage++; renderVideos() }
  })

  // 削除処理
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('本当に削除しますか？')) {
        const { error } = await supabase.from('videos').delete().eq('id', btn.dataset.id)
        if (error) alert('削除に失敗しました')
        else { alert('削除しました'); loadVideos() }
      }
    })
  })
}

// 並び替えボタン
document.getElementById('sort-popular').addEventListener('click', () => {
  currentSort = 'popular'
  document.getElementById('sort-popular').classList.add('active')
  document.getElementById('sort-latest').classList.remove('active')
  loadVideos()
})
document.getElementById('sort-latest').addEventListener('click', () => {
  currentSort = 'latest'
  document.getElementById('sort-latest').classList.add('active')
  document.getElementById('sort-popular').classList.remove('active')
  loadVideos()
})
