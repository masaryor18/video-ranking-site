// src/admin.js
import { createClient } from '@supabase/supabase-js'

// ===============================
// Supabase 設定
// ===============================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ===============================
// 状態
// ===============================
let currentPage = 1
const perPage = 20
let sortMode = 'popular'
let failedAttempts = 0
const MAX_ATTEMPTS = 5

// ===============================
// ログイン
// ===============================
document.getElementById('login-btn')?.addEventListener('click', async () => {
  const password = document.getElementById('admin-password').value.trim()
  const error = document.getElementById('login-error')
  const attemptsEl = document.getElementById('login-attempts')

  const lockUntil = localStorage.getItem('lockUntil')
  if (lockUntil && Date.now() < Number(lockUntil)) {
    error.textContent = 'ロック中です。しばらくしてからお試しください。'
    error.style.display = 'block'
    return
  }

  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password
  })

  if (!loginError) {
    console.log('✅ ログイン成功')
    error.style.display = 'none'
    failedAttempts = 0
    attemptsEl.textContent = `試行回数: 0 / ${MAX_ATTEMPTS}`
    document.getElementById('login-section').style.display = 'none'
    document.getElementById('admin-section').style.display = 'block'
    loadVideos()
  } else {
    console.warn('❌ ログイン失敗:', loginError)
    failedAttempts++
    attemptsEl.textContent = `試行回数: ${failedAttempts} / ${MAX_ATTEMPTS}`

    if (failedAttempts >= MAX_ATTEMPTS) {
      const lockTime = Date.now() + 60 * 60 * 1000
      localStorage.setItem('lockUntil', lockTime)
      error.textContent = '5回間違えたため、1時間ロックされます。'
    } else {
      error.textContent = 'パスワードが違います。'
    }
    error.style.display = 'block'
  }
})

// ===============================
// 画像リサイズ関数
// ===============================
async function resizeImage(file, maxWidth = 480, maxHeight = 270) {
  return new Promise((resolve) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      let width = img.width
      let height = img.height
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
    }

    img.src = URL.createObjectURL(file)
  })
}

// ===============================
// コンテンツ登録
// ===============================
document.getElementById('upload-form-inner')?.addEventListener('submit', async (e) => {
  e.preventDefault()

  const title = document.getElementById('title').value.trim()
  const link_url = document.getElementById('link_url').value.trim()
  const file = document.getElementById('thumbnail').files[0]

  if (!file) {
    alert('画像を選択してください')
    return
  }

  try {
    const resizedBlob = await resizeImage(file)
    const fileName = `${Date.now()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(`uploads/${fileName}`, resizedBlob, {
        contentType: 'image/jpeg',
        upsert: false
      })
    if (uploadError) throw uploadError

    const { data: pub } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(`uploads/${fileName}`)
    const publicUrl = pub?.publicUrl || ''

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
    console.error('❌ アップロードエラー:', err)
    alert('アップロードに失敗しました')
  }
})

// ===============================
// 動画一覧
// ===============================
async function loadVideos() {
  const list = document.getElementById('video-list')
  if (!list) return
  list.innerHTML = '<p style="color:gray;">読み込み中...</p>'

  let query = supabase.from('videos').select('*')
  query =
    sortMode === 'latest'
      ? query.order('created_at', { ascending: false })
      : query.order('views', { ascending: false }).order('created_at', { ascending: false })

  const { data, error } = await query.range((currentPage - 1) * perPage, currentPage * perPage - 1)
  if (error) {
    console.error('❌ 取得エラー:', error)
    list.innerHTML = '<p style="color:red;">読み込みに失敗しました</p>'
    return
  }

  list.innerHTML = ''
  data.forEach(v => {
    const div = document.createElement('div')
    div.className = 'video-item'
    div.innerHTML = `
      <img src="${v.thumbnail_url}" alt="thumb">
      <div>
        <strong>${escapeHTML(v.title || '')}</strong><br>
        <a href="${escapeAttr(v.link_url || '')}" target="_blank">${escapeHTML(v.link_url || '')}</a><br>
        <span style="color:#ccc;">再生回数：${Number(v.views ?? 0)}</span><br>
        <button data-id="${v.id}" class="delete-btn">削除</button>
      </div>
    `
    list.appendChild(div)
  })

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('本当に削除しますか？')) return
      const id = btn.dataset.id
      const { error: delErr } = await supabase.from('videos').delete().eq('id', id)
      if (delErr) {
        console.error('❌ 削除エラー:', delErr)
        alert('削除に失敗しました')
      } else {
        alert('削除しました')
        loadVideos()
      }
    })
  })
}

// ===============================
// エスケープ関数
// ===============================
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  )
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;')
}
