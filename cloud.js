(function setupCloudStore() {
  const config = window.SUPABASE_CONFIG || {};
  const configured = Boolean(config.url && config.publishableKey);
  let client = null;
  let currentUser = null;
  let realtimeChannel = null;
  let pushTimer = null;
  let lastSnapshot = '';
  let callbacks = null;

  function setSyncStatus(state, label) {
    const node = document.getElementById('syncStatus');
    if (!node) return;
    const icons = { local: 'hard-drive', syncing: 'refresh-cw', synced: 'cloud-check', error: 'cloud-off' };
    node.className = `sync-status ${state}`;
    node.innerHTML = `<i data-lucide="${icons[state] || icons.local}"></i><span>${label}</span>`;
    if (window.lucide) lucide.createIcons();
  }

  function showAuth(message = '') {
    document.getElementById('authBackdrop')?.classList.remove('hidden');
    setAuthMessage(message);
  }

  function hideAuth() {
    document.getElementById('authBackdrop')?.classList.add('hidden');
  }

  function setAuthMessage(message, success = false) {
    const node = document.getElementById('authMessage');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('success', success);
  }

  function updateAccountUi() {
    const email = currentUser?.email || '本地账户';
    const emailNode = document.getElementById('accountEmail');
    const modeNode = document.getElementById('accountMode');
    const signOut = document.getElementById('signOutButton');
    if (emailNode) emailNode.textContent = email;
    if (modeNode) modeNode.textContent = currentUser ? 'Supabase 云端同步已开启' : '数据仅保存在此设备';
    signOut?.classList.toggle('hidden', !currentUser);
  }

  function validBoardData(value) {
    return value && Array.isArray(value.events) && Array.isArray(value.tasks);
  }

  async function pullCloudData() {
    if (!currentUser) return;
    setSyncStatus('syncing', '正在读取');
    const { data: row, error } = await client.from('user_boards').select('board_data, updated_at').eq('user_id', currentUser.id).maybeSingle();
    if (error) throw error;
    if (!row) {
      await pushSnapshot(callbacks.getData());
      return;
    }
    if (validBoardData(row.board_data)) {
      lastSnapshot = JSON.stringify(row.board_data);
      callbacks.applyData(row.board_data);
    }
    setSyncStatus('synced', '云端已同步');
  }

  async function pushSnapshot(snapshot) {
    if (!currentUser) return;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSnapshot) return;
    setSyncStatus('syncing', '正在同步');
    const { error } = await client.from('user_boards').upsert({ user_id: currentUser.id, board_data: snapshot }, { onConflict: 'user_id' });
    if (error) {
      setSyncStatus('error', '同步失败');
      throw error;
    }
    lastSnapshot = serialized;
    setSyncStatus('synced', '云端已同步');
  }

  function schedulePush(snapshot) {
    if (!currentUser) return;
    const stableSnapshot = JSON.parse(JSON.stringify(snapshot));
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushSnapshot(stableSnapshot).catch(error => console.error('Supabase sync failed:', error.message)), 350);
  }

  async function subscribeToChanges() {
    if (realtimeChannel) await client.removeChannel(realtimeChannel);
    realtimeChannel = client.channel(`board-${currentUser.id}`).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'user_boards',
      filter: `user_id=eq.${currentUser.id}`
    }, payload => {
      const next = payload.new?.board_data;
      const serialized = JSON.stringify(next);
      if (validBoardData(next) && serialized !== lastSnapshot) {
        lastSnapshot = serialized;
        callbacks.applyData(next);
        setSyncStatus('synced', '已接收更新');
      }
    }).subscribe();
  }

  async function handleSession(session) {
    currentUser = session?.user || null;
    updateAccountUi();
    if (!currentUser) {
      setSyncStatus('local', configured ? '等待登录' : '本地模式');
      if (configured) showAuth();
      return;
    }
    hideAuth();
    try {
      await pullCloudData();
      await subscribeToChanges();
    } catch (error) {
      setSyncStatus('error', '连接失败');
      console.error('Supabase initialization failed:', error.message);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    setAuthMessage('正在登录...');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage(error.message);
  }

  async function signUp() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!email || password.length < 6) { setAuthMessage('请填写有效邮箱和至少 6 位密码。'); return; }
    setAuthMessage('正在创建账户...');
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) { setAuthMessage(error.message); return; }
    if (!data.session) setAuthMessage('账户已创建，请检查邮箱并完成验证。', true);
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    document.getElementById('accountPopover')?.classList.add('hidden');
  }

  function exportBoardData() {
    if (!callbacks) return;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: callbacks.getData()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `focus-gtd-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBoardData(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !callbacks) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = parsed.data || parsed;
      if (!validBoardData(imported)) throw new Error('invalid data');
      callbacks.applyData(imported);
      schedulePush(imported);
      window.toast?.(currentUser ? '数据已导入并开始同步' : '数据已导入到本地');
      document.getElementById('accountPopover')?.classList.add('hidden');
    } catch {
      window.toast?.('导入失败，请选择有效的看板备份文件');
    }
  }

  async function init(nextCallbacks) {
    callbacks = nextCallbacks;
    updateAccountUi();
    document.getElementById('accountButton')?.addEventListener('click', () => document.getElementById('accountPopover')?.classList.toggle('hidden'));
    document.getElementById('authForm')?.addEventListener('submit', signIn);
    document.getElementById('signUpButton')?.addEventListener('click', signUp);
    document.getElementById('signOutButton')?.addEventListener('click', signOut);
    document.getElementById('exportDataButton')?.addEventListener('click', exportBoardData);
    document.getElementById('importDataButton')?.addEventListener('click', () => document.getElementById('importDataInput')?.click());
    document.getElementById('importDataInput')?.addEventListener('change', importBoardData);
    document.getElementById('continueLocalButton')?.addEventListener('click', () => { hideAuth(); setSyncStatus('local', '本地模式'); });
    if (!configured) { setSyncStatus('local', '本地模式'); return; }
    if (!window.supabase?.createClient) { setSyncStatus('error', '组件未加载'); return; }
    client = window.supabase.createClient(config.url, config.publishableKey);
    client.auth.onAuthStateChange((_event, session) => setTimeout(() => handleSession(session), 0));
    const { data: { session } } = await client.auth.getSession();
    await handleSession(session);
    window.addEventListener('focus', () => { if (currentUser) pullCloudData().catch(() => setSyncStatus('error', '同步失败')); });
  }

  window.cloudStore = { init, schedulePush, configured: () => configured };
})();
