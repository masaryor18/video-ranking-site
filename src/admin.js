import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const loginPanel = document.getElementById('login-panel')
const appPanel   = document.getElementById('app-panel')
const loginBtn   = document.getElementById('login-btn')
const logoutBtn  = document.getElementById('logout-btn')
const pwdInput   = document.getElementById('admin-password')

const form = document.getElementById('upload-form')
const list = document.getElementById('video-list')

/** 既にログインセッションがあれば復元 */
init()

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    showApp()
    loadVideos()
  } else {
    showLogin()
  }
}

function showLogin()  { loginPanel.classList.remove('hidden'); appPanel.classList.add('hidden') }
function showApp()    { loginPanel.classList.add('hidden');    appPanel.classList.remove('hidden') }

/** ログイン処理（メールは環境変数、入力はパスワードだけ） */
loginBtn.addEventListener('click', async () => {
  const password = pwdInput.value
  if (!password) return alert('パスワードを入力してください')
  const { error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password
  })
  if (error) {
    console.error(error)
    return alert('ログインに失敗しました')
  }
  showApp()
  loadVideos()
})

/** ログアウト */
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut()
  pwdInput.value = ''
  showLogin()
})

/** 動画の新規登録 */
form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const title    = document.getElementById('title').value
  const link_url = document.getElementById('link_url').value
  const file     = document.getElementById('thumbnail').files[0]
  if (!file) return alert('サムネイルを選択してください')

  // 1) サムネイルをStorageへ
  const fileName = `${Date.now()}-${file.name}`
  const { error: upErr } = await supabase.storage.from('thumbnails').upload(fileName, file)
  if (upErr) { console.error(upErr); return alert('画像アップロードに失敗しました') }

  // 2) 公開URL取得
  const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
  const thumbnail_url = urlData.publicUrl

  // 3) DBへ登録
  const { error } = await supabase.from('videos').insert([{ title, link_url, thumbnail_url, views: 0 }])
  if (error) { console.error(error); return alert('DB登録に失敗しました') }

  alert('登録しました')
  form.reset()
  loadVideos()
})

/** 一覧の読み込み */
async function loadVideos() {
  const { data, error } = await supabase
    .from('videos')
    .select('id,title,thumbnail_url,link_url')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return }

  list.innerHTML = ''
  for (const v of data) {
    const row = document.createElement('div')
    row.className = 'video-item'
    row.innerHTML = `
      <div style="max-width:70%">
        <strong>${escapeHTML(v.title)}</strong><br>
        <small style="color:#666">${escapeHTML(v.link_url)}</small>
      </div>
      <div class="actions">
        <button data-id="${v.id}" class="del">削除</button>
      </div>
    `
    row.querySelector('.del').addEventListener('click', () => deleteVideo(v.id))
    list.appendChild(row)
  }
}

async function deleteVideo(id) {
  if (!confirm('この動画を削除しますか？')) return
  const { error } = await supabase.from('videos').delete().eq('id', id)
  if (error) { console.error(error); return alert('削除に失敗しました') }
  loadVideos()
}

function escapeHTML(s){ return String(s??'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }
