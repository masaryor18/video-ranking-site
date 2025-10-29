import { createClient } from '@supabase/supabase-js'

// ===============================
// Supabase環境変数読み込み
// ===============================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ===============================
// ログイン処理
// ===============================
// ===============================
// ログイン処理（連続5回ミスで1時間ロック）
// ===============================
document.getElementById('login-btn').addEventListener('click', () => {
  const input = document.getElementById('admin-password').value
  const error = document.getElementById('login-error')
  const now = Date.now()

  const lockUntil = parseInt(localStorage.getItem('lockUntil') || '0')
  let attempts = parseInt(localStorage.getItem('attempts') || '0')
  let lastAttempt = parseInt(localStorage.getItem('lastAttempt') || '0')

  // ロック中判定
  if (lockUntil && now < lockUntil) {
    const minutes = Math.ceil((lockUntil - now) / 60000)
    error.textContent = `ロック中です。${minutes}分後に再試行できます。`
    error.style.display = 'block'
    return
  }

  // 10分以上空いたらリセット
  if (now - lastAttempt > 10 * 60 * 1000) {
    attempts = 0
  }

  // 照合
  if (input === ADMIN_PASSWORD) {
    localStorage.removeItem('attempts')
    localStorage.removeItem('lockUntil')
    localStorage.removeItem('lastAttempt')
    error.style.display = 'none'
    document.getElementById('login-section').style.display = 'none'
    document.getElementById('admin-section').style.display = 'block'
    loadVideos()
  } else {
    attempts++
    localStorage.setItem('attempts', attempts)
    localStorage.setItem('lastAttempt', now)

    if (attempts >= 5) {
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


// ===============================
// 設定・状態
// ===============================
let currentPage = 1
const perPage = 20
let sortMode = 'popular'

// ===============================
// 並び替えボタン
// ===============================
document.getElementById('sort-popular').addEventListener('click', () => {
  sortMode = 'popular'
  document.getElementById('sort-popular').classList.add('active')
  document.getElementById('sort-latest').classList.remove('active')
  currentPage = 1
  loadVideos()
})

document.getElementById('sort-latest').addEventListener('click', () => {
  sortMode = 'latest'
  document.getElementById('sort-latest').classList.add('active')
  document.getElementById('sort-popular').classList.remove('active')
  currentPage = 1
  loadVideos()
})

// ===============================
// ページネーション
// ===============================
document.getElementById('prev-page').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--
    loadVideos()
  }
})

document.getElementById('next-page').addEventListener('click', () => {
  currentPage++
  loadVideos()
})

// ===============================
// コンテンツ登録処理
// ===============================
document.getElementById('upload-form-inner').addEventListener('submit', async (e) => {
  e.preventDefault()

  const title = document.getElementById('title').value
  const link_url = document.getElementById('link_url').value
  const file = document.getElementById('thumbnail').files[0]

  if (!file) return alert('画像を選択してください')

  try {
    // Storageへアップロード
    const fileName = `${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // 公開URL取得
    const { data: { publicUrl } } = supabase
      .storage
      .from('thumbnails')
      .getPublicUrl(fileName)

    // DB登録
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

// ===============================
// 動画一覧読み込み
// ===============================
async function loadVideos() {
  const list = document.getElementById('video-list')
  list.innerHTML = '<p style="color:gray;">読み込み中...</p>'

  let query = supabase.from('videos').select('*')

  if (sortMode === 'latest') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('views', { ascending: false }) // 人気順（viewsカラム）
  }

  const from = (currentPage - 1) * perPage
  const to = from + perPage - 1

  const { data, error } = await query.range(from, to)

  if (error) {
    console.error(error)
    list.innerHTML = '<p style="color:red;">読み込みに失敗しました</p>'
    return
  }

  if (!data.length) {
    list.innerHTML = '<p style="color:gray;">登録された動画はありません。</p>'
    return
  }

  list.innerHTML = ''
  data.forEach(v => {
    const div = document.createElement('div')
    div.classList.add('video-item')
    div.innerHTML = `
  <img src="${v.thumbnail_url}" alt="thumb">
  <div>
    <strong>${v.title}</strong><br>
    <a href="${v.link_url}" target="_blank">${v.link_url}</a><br>
    <span style="color:#ccc;">再生回数：${v.views ?? 0}</span><br>
    <button data-id="${v.id}" class="delete-btn">削除</button>
  </div>
`

    `
    list.appendChild(div)
  })

  // ページ番号更新
  document.getElementById('page-num').textContent = currentPage

  // 削除ボタン動作
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('本当に削除しますか？')) {
        const id = btn.getAttribute('data-id')
        const { error: deleteError } = await supabase.from('videos').delete().eq('id', id)
        if (deleteError) {
          alert('削除に失敗しました')
        } else {
          alert('削除しました')
          loadVideos()
        }
      }
    })
  })
}
