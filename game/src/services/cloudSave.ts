import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SAVE_KEY = 'happyFarmPhaserSaveV1';
const LOCAL_UPDATED_KEY = 'happyFarmLocalUpdatedAtV1';
const LOCAL_DIRTY_KEY = 'happyFarmLocalDirtyV1';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

type CloudStatus = 'offline' | 'signed-out' | 'syncing' | 'synced' | 'error' | 'unconfigured';
let client: SupabaseClient | null = null;
let currentUserId: string | null = null;
let currentUserEmail: string | null = null;
let syncInProgress = false;
let cloudReady = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let cloudSaveQueued = false;
let cloudInitialized = false;

function setStatus(next: CloudStatus, message?: string): void {
  const label = document.getElementById('cloud-save-status');
  if (label) {
    const defaults: Record<CloudStatus, string> = {
      offline: 'Offline · saved on this device',
      'signed-out': 'Not signed in · saved on this device',
      syncing: 'Syncing farm…',
      synced: 'Cloud save synced',
      error: 'Cloud sync failed · local save is safe',
      unconfigured: 'Cloud saves need setup',
    };
    label.textContent = message || defaults[next];
    label.dataset.status = next;
  }
  const button = document.getElementById('cloud-account');
  if (button) {
    button.textContent = currentUserId ? '☁ Signed in' : '☁ Sign in';
    button.title = currentUserId ? `Signed in${currentUserEmail ? ` as ${currentUserEmail}` : ''}` : 'Cloud save account';
  }
  const authForm = document.getElementById('cloud-auth-form');
  const modeButton = document.getElementById('cloud-auth-mode');
  const accountIdentity = document.getElementById('cloud-account-identity');
  if (authForm) authForm.hidden = Boolean(currentUserId);
  if (modeButton) modeButton.hidden = Boolean(currentUserId);
  if (accountIdentity) {
    accountIdentity.hidden = !currentUserId;
    accountIdentity.textContent = currentUserEmail ? `Signed in as ${currentUserEmail}` : 'You are signed in.';
  }
}

function isPristineStarterSave(save: Record<string, unknown> | null): boolean {
  if (!save) return false;
  const decor = save.decor && typeof save.decor === 'object' ? save.decor as Record<string, unknown> : {};
  const animals = Array.isArray(save.animals) ? save.animals : [];
  const plots = Array.isArray(save.plots) ? save.plots as Array<Record<string, unknown>> : [];
  const inventory = save.inventory && typeof save.inventory === 'object' ? save.inventory as Record<string, unknown> : {};
  const starterInventory = Number(inventory.wheat) === 3 &&
    ['carrot','corn','strawberry','tomato','pumpkin','blueberry','watermelon'].every(key => Number(inventory[key] || 0) === 0);
  const starterPlots = plots.length > 0 && plots.every(plot =>
    plot.state === 'grass' || plot.state === 'tilled'
  ) && plots.filter(plot => plot.state === 'tilled').length <= 3;
  return Number(save.coins) === 250 &&
    Number(save.xp) === 0 &&
    Number(save.harvests || 0) === 0 &&
    Number(save.landExpansionCount || 0) === 0 &&
    Object.keys(decor).every(key => key === 'farmhouse') &&
    animals.length === 0 &&
    starterInventory &&
    starterPlots;
}

function localSnapshot(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch {
    return null;
  }
}


// Export/import contains only the farm save payload. It never includes Supabase
// credentials, auth tokens, email addresses, or browser storage contents.
function validateFarmSave(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const save = value as Record<string, unknown>;
  const validVersions = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19];
  if (!validVersions.includes(Number(save.version)) || !Array.isArray(save.plots)) return false;
  if (!Number.isFinite(Number(save.coins)) || Number(save.coins) < 0 ||
      !Number.isFinite(Number(save.xp)) || Number(save.xp) < 0 ||
      !Array.isArray(save.animals) || !save.inventory || typeof save.inventory !== 'object' ||
      !save.feed || typeof save.feed !== 'object') return false;
  if (save.plots.length > 1000 || save.animals.length > 500) return false;
  return save.plots.every((plot: any) => plot && Number.isInteger(plot.col) &&
    Number.isInteger(plot.row) && ['grass','tilled','growing','ready','withered'].includes(plot.state));
}

function farmProgressScore(save: Record<string, unknown> | null): number {
  if (!save) return 0;
  const animals = Array.isArray(save.animals) ? save.animals.length : 0;
  const decor = save.decor && typeof save.decor === 'object' ? Object.keys(save.decor as object).length : 0;
  const plots = Array.isArray(save.plots) ? save.plots.filter((p: any) => p && p.state !== 'grass').length : 0;
  const land = Array.isArray(save.landTiles) ? save.landTiles.length : 0;
  return Number(save.xp || 0) * 1000 + Number(save.harvests || 0) * 100 +
    animals * 25 + decor * 10 + plots * 2 + land;
}

function archiveCurrentSaveBeforeReplacement(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return true;
    const current = JSON.parse(raw) as Record<string, unknown>;
    const key = 'happyFarmRecoveryBackupsV1';
    const backups = JSON.parse(localStorage.getItem(key) || '[]') as Array<{savedAt:number;save:Record<string,unknown>}>;
    if (!backups.some(item => JSON.stringify(item.save) === raw)) {
      backups.unshift({ savedAt: Date.now(), save: current });
      localStorage.setItem(key, JSON.stringify(backups.slice(0, 12)));
    }
    return true;
  } catch (error) {
    console.error('Farm replacement blocked because the current save could not be archived:', error);
    return false;
  }
}

function exportFarmBackup(): void {
  const save = localSnapshot();
  if (!validateFarmSave(save)) {
    window.alert('The current farm save could not be validated. No backup file was created.');
    return;
  }
  const payload = { format: 'happy-farm-backup', formatVersion: 1, exportedAt: new Date().toISOString(), save };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'happy-farm-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function importFarmBackup(file: File | null): Promise<void> {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    window.alert('Backup file is larger than 5 MB. Import was cancelled.');
    return;
  }
  try {
    const parsed = JSON.parse(await file.text());
    const save = parsed?.format === 'happy-farm-backup' ? parsed.save : parsed;
    if (!validateFarmSave(save)) {
      window.alert('This file is not a valid Happy Farm save. Your current farm was not changed.');
      return;
    }
    const level = Math.max(1, Math.floor(Number(save.xp || 0) / 100) + 1);
    if (!window.confirm('Import this backup (approximately Level ' + level + ', ' +
      Number(save.coins).toLocaleString() + ' coins)? Your current farm will first be archived.')) return;
    if (!archiveCurrentSaveBeforeReplacement()) {
      window.alert('Import blocked: the current farm could not be safely archived.');
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    localStorage.setItem(LOCAL_UPDATED_KEY, String(Date.now()));
    localStorage.setItem(LOCAL_DIRTY_KEY, 'true');
    sessionStorage.removeItem('happyFarmCloudRestoreAttemptedV1');
    window.location.reload();
  } catch (error) {
    window.alert('Could not import backup: ' + (error instanceof Error ? error.message : String(error)));
  }
}

async function syncWithCloud(): Promise<void> {
  if (!client || !currentUserId || !navigator.onLine) return;
  if (syncInProgress) {
    cloudSaveQueued = true;
    return;
  }

  syncInProgress = true;
  cloudSaveQueued = false;
  setStatus('syncing');

  // Take the local revision before the network read. A save made while the
  // request is in flight must always take precedence over the remote snapshot.
  const revisionAtRead = Number(localStorage.getItem(LOCAL_UPDATED_KEY) || 0);
  const localAtRead = localSnapshot();
  const dirtyAtRead = localStorage.getItem(LOCAL_DIRTY_KEY) === 'true';

  try {
    const { data: remote, error } = await client.from('farm_saves')
      .select('save_data, updated_at').eq('user_id', currentUserId).maybeSingle();
    if (error) throw error;

    const storedLocalUpdatedAt = Number(localStorage.getItem(LOCAL_UPDATED_KEY) || 0);
    const preserveLegacyLocal = Boolean(localAtRead) &&
      (!Number.isFinite(storedLocalUpdatedAt) || storedLocalUpdatedAt <= 0);
    const localUpdatedAt = preserveLegacyLocal ? Date.now() : storedLocalUpdatedAt;
    if (preserveLegacyLocal) localStorage.setItem(LOCAL_UPDATED_KEY, String(localUpdatedAt));

    const latestLocalUpdatedAt = Number(localStorage.getItem(LOCAL_UPDATED_KEY) || 0);
    const latestLocalIsDirty = localStorage.getItem(LOCAL_DIRTY_KEY) === 'true';
    const localChangedDuringFetch = latestLocalUpdatedAt !== revisionAtRead;
    const remoteUpdatedAt = remote?.updated_at ? Date.parse(remote.updated_at) : 0;
    // Restore an existing cloud farm if startup has produced only a pristine starter snapshot.
    const latestLocalSnapshot = localSnapshot();
    const localIsPristineStarter = isPristineStarterSave(latestLocalSnapshot);
    // Do not reload repeatedly when the cloud snapshot is already the exact
    // snapshot stored locally (notably when both contain the starter farm).
    const remoteDiffersFromLocal = Boolean(remote?.save_data) &&
      JSON.stringify(remote?.save_data) !== JSON.stringify(latestLocalSnapshot);

    const restoreAttemptKey = 'happyFarmCloudRestoreAttemptedV1';
    const restoreAlreadyAttempted = sessionStorage.getItem(restoreAttemptKey) === 'true';

    if (
      remote?.save_data &&
      remoteDiffersFromLocal &&
      !preserveLegacyLocal &&
      !dirtyAtRead &&
      !latestLocalIsDirty &&
      !localChangedDuringFetch &&
      (remoteUpdatedAt > localUpdatedAt || localIsPristineStarter)
    ) {
      // Limit automatic restore to one reload per browser tab. If the
      // snapshots still differ after that, preserve both rather than looping
      // or uploading the local starter snapshot over the cloud copy.
      if (restoreAlreadyAttempted) {
        setStatus('error', 'Cloud save differs from this device · automatic restore paused to protect your farm');
        cloudReady = true;
        return;
      }
      sessionStorage.setItem(restoreAttemptKey, 'true');
      localStorage.setItem(SAVE_KEY, JSON.stringify(remote.save_data));
      localStorage.setItem(LOCAL_UPDATED_KEY, String(remoteUpdatedAt));
      setStatus('synced', 'Cloud farm restored · refreshing game…');
      window.location.reload();
      return;
    }

    // Never upload a clearly less-developed local farm over a stronger cloud farm
    // just because timestamps or device clocks disagree. Require manual recovery review.
    if (remote?.save_data && latestLocalSnapshot && !localIsPristineStarter &&
        validateFarmSave(remote.save_data) &&
        farmProgressScore(remote.save_data) > farmProgressScore(latestLocalSnapshot) * 1.15) {
      setStatus('error', 'Cloud farm appears more developed than this device · sync paused to prevent progress loss');
      cloudReady = true;
      return;
    }

    // Upload the latest snapshot. Keep it marked dirty until the server confirms
    // the exact updated_at value, so clock skew cannot make an older cloud copy win
    // on the next page load.
    const latestLocal = localSnapshot();
    if (latestLocal) {
      // Keep an independent cloud recovery point at most once per 24 hours.
      // The recovery table is separate from farm_saves, so ordinary gameplay saves
      // never create a GitHub commit or a recovery row on every action.
      if (remote?.save_data) {
        try {
          const { data: latestBackup, error: backupReadError } = await client
            .from('farm_save_recovery')
            .select('created_at')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (backupReadError) throw backupReadError;
          const lastBackupAt = latestBackup?.created_at ? Date.parse(latestBackup.created_at) : 0;
          if (!lastBackupAt || Date.now() - lastBackupAt >= 24 * 60 * 60 * 1000) {
            const { error: backupInsertError } = await client
              .from('farm_save_recovery')
              .insert({ user_id: currentUserId, save_data: remote.save_data });
            if (backupInsertError) throw backupInsertError;
            // Keep a rolling 30-day history. RLS limits deletion to this player's rows.
            const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { error: cleanupError } = await client
              .from('farm_save_recovery')
              .delete()
              .eq('user_id', currentUserId)
              .lt('created_at', retentionCutoff);
            if (cleanupError) console.warn('Happy Farm recovery retention cleanup failed:', cleanupError);
          }
        } catch (backupError) {
          console.error('Happy Farm cloud recovery snapshot failed:', backupError);
          setStatus('error', 'Recovery backup unavailable · cloud overwrite paused');
          cloudReady = true;
          return;
        }
      }

      // Preserve the cloud snapshot locally before any upsert can replace it.
      // This gives the browser a recovery copy even when a newer local revision wins.
      if (remote?.save_data) {
        try {
          const backupKey = 'happyFarmCloudRecoveryBackupsV1';
          const rawBackups = localStorage.getItem(backupKey);
          const backups = rawBackups ? JSON.parse(rawBackups) as Array<{ savedAt: number; updatedAt: string | null; save: unknown }> : [];
          const remoteJson = JSON.stringify(remote.save_data);
          if (!backups.some(entry => JSON.stringify(entry.save) === remoteJson)) {
            backups.unshift({ savedAt: Date.now(), updatedAt: remote.updated_at || null, save: remote.save_data });
            localStorage.setItem(backupKey, JSON.stringify(backups.slice(0, 12)));
          }
        } catch (backupError) {
          console.warn('Happy Farm could not archive the previous cloud save:', backupError);
          setStatus('error', 'Could not create a cloud recovery copy · sync paused');
          cloudReady = true;
          return;
        }
      }
      const uploadedLocalUpdatedAt = Number(localStorage.getItem(LOCAL_UPDATED_KEY) || 0);
      const { data: saved, error: saveError } = await client.from('farm_saves')
        .upsert({
          user_id: currentUserId,
          save_data: latestLocal,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select('updated_at')
        .single();
      if (saveError) throw saveError;

      const currentLocalUpdatedAt = Number(localStorage.getItem(LOCAL_UPDATED_KEY) || 0);
      if (currentLocalUpdatedAt === uploadedLocalUpdatedAt) {
        localStorage.removeItem(LOCAL_DIRTY_KEY);
        const confirmedRemoteUpdatedAt = saved?.updated_at ? Date.parse(saved.updated_at) : 0;
        if (confirmedRemoteUpdatedAt > 0) {
          localStorage.setItem(LOCAL_UPDATED_KEY, String(confirmedRemoteUpdatedAt));
        }
      } else {
        cloudSaveQueued = true;
      }
    }

    cloudReady = true;
    setStatus('synced');
  } catch (error) {
    console.error('Happy Farm cloud sync failed:', error);
    cloudReady = true;
    setStatus('error');
  } finally {
    syncInProgress = false;
    if (cloudSaveQueued && client && currentUserId && navigator.onLine && cloudReady) {
      scheduleCloudSave();
    }
  }
}

function scheduleCloudSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void syncWithCloud();
  }, 1800);
}

export function queueCloudSave(): void {
  if (!client || !currentUserId) return;
  // Mark the local snapshot as authoritative until this exact version reaches the cloud.
  // This prevents a slightly newer server receipt timestamp from overwriting a fresh purchase.
  try { localStorage.setItem(LOCAL_DIRTY_KEY, 'true'); } catch { /* Local gameplay save remains available. */ }
  cloudSaveQueued = true;
  if (!syncInProgress && cloudReady) scheduleCloudSave();
}

type RecoveryEntry = { source: 'This device' | 'Cloud device copy' | 'Supabase history'; savedAt: number; save: Record<string, unknown> };

function recoveryLevel(save: Record<string, unknown>): number {
  return Math.max(1, Math.floor(Number(save.xp || 0) / 100) + 1);
}

async function showRecoveryHistory(): Promise<void> {
  const panel = document.getElementById('recovery-history');
  const list = document.getElementById('recovery-list');
  const status = document.getElementById('recovery-status');
  if (!panel || !list || !status) return;
  panel.hidden = false;
  list.replaceChildren();
  status.textContent = 'Checking this device and cloud backups…';
  const button = document.getElementById('cloud-recovery-open') as HTMLButtonElement | null;
  if (button) button.disabled = true;
  try {
    const entries: RecoveryEntry[] = [];
    const readLocal = (key: string, source: RecoveryEntry['source']) => {
      try {
        const raw = localStorage.getItem(key);
        const backups = raw ? JSON.parse(raw) as Array<{savedAt?:number;updatedAt?:string|null;save?:Record<string,unknown>}> : [];
        backups.forEach(item => {
          if (item?.save && typeof item.save === 'object') entries.push({
            source, savedAt: Number(item.savedAt || (item.updatedAt ? Date.parse(item.updatedAt) : 0)) || Date.now(), save: item.save
          });
        });
      } catch (error) { console.warn('Could not read local recovery history:', error); }
    };
    readLocal('happyFarmRecoveryBackupsV1', 'This device');
    readLocal('happyFarmCloudRecoveryBackupsV1', 'Cloud device copy');
    if (client && currentUserId && navigator.onLine) {
      const { data, error } = await client.from('farm_save_recovery')
        .select('save_data, created_at').eq('user_id', currentUserId)
        .order('created_at', { ascending: false }).limit(30);
      if (error) throw error;
      (data || []).forEach(row => {
        if (row.save_data && typeof row.save_data === 'object') entries.push({
          source: 'Supabase history', savedAt: Date.parse(row.created_at), save: row.save_data as Record<string,unknown>
        });
      });
    }
    entries.sort((a,b)=>b.savedAt-a.savedAt);
    if (!entries.length) status.textContent = 'No recovery snapshots found yet. Snapshots will appear as your farm is saved.';
    else {
      status.textContent = entries.length + ' snapshots found. Choose one to inspect its date and restore it. Your current farm is backed up first.';
      entries.forEach(entry => {
        const card = document.createElement('article');
        card.className = 'recovery-entry';
        const details = document.createElement('div');
        const heading = document.createElement('strong');
        heading.textContent = entry.source + ' · Level ' + recoveryLevel(entry.save);
        const meta = document.createElement('small');
        meta.textContent = new Date(entry.savedAt).toLocaleString() + ' · ' +
          Number(entry.save.coins || 0).toLocaleString() + ' coins · ' +
          (Array.isArray(entry.save.animals) ? entry.save.animals.length : 0) + ' animals';
        details.append(heading, meta);
        const restore = document.createElement('button');
        restore.type = 'button';
        restore.textContent = 'Restore';
        restore.addEventListener('click', () => {
          const when = new Date(entry.savedAt).toLocaleString();
          if (!window.confirm('Restore this ' + entry.source + ' snapshot from ' + when + '? Your current farm will first be saved as a recovery copy.')) return;
          try {
            const currentRaw = localStorage.getItem(SAVE_KEY);
            if (currentRaw) {
              const key = 'happyFarmRecoveryBackupsV1';
              const current = JSON.parse(currentRaw) as Record<string,unknown>;
              const old = JSON.parse(localStorage.getItem(key) || '[]') as Array<{savedAt:number;save:Record<string,unknown>}>;
              if (!old.some(item => JSON.stringify(item.save) === currentRaw)) {
                old.unshift({savedAt:Date.now(),save:current});
                localStorage.setItem(key, JSON.stringify(old.slice(0,12)));
              }
            }
            localStorage.setItem(SAVE_KEY, JSON.stringify(entry.save));
            localStorage.setItem(LOCAL_UPDATED_KEY, String(Date.now()));
            localStorage.setItem(LOCAL_DIRTY_KEY, 'true');
            sessionStorage.removeItem('happyFarmCloudRestoreAttemptedV1');
            status.textContent = 'Restoring selected snapshot…';
            window.location.reload();
          } catch (error) {
            status.textContent = 'Restore failed: ' + (error instanceof Error ? error.message : String(error));
          }
        });
        card.append(details, restore);
        list.append(card);
      });
    }
  } catch (error) {
    status.textContent = 'Could not load recovery history: ' + (error instanceof Error ? error.message : String(error));
  } finally { if (button) button.disabled = false; }
}

function showAccountModal(): void {
  document.getElementById('cloud-account-modal')?.classList.add('open');
  document.getElementById('cloud-account-modal')?.setAttribute('aria-hidden', 'false');
}
function hideAccountModal(): void {
  document.getElementById('cloud-account-modal')?.classList.remove('open');
  document.getElementById('cloud-account-modal')?.setAttribute('aria-hidden', 'true');
}

export function initializeCloudSaves(): void {
  if (cloudInitialized) return;
  cloudInitialized = true;
  document.getElementById('cloud-account')?.addEventListener('click', showAccountModal);
  document.getElementById('cloud-account-close')?.addEventListener('click', hideAccountModal);
  document.getElementById('cloud-account-modal')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) hideAccountModal();
  });

  const form = document.getElementById('cloud-auth-form') as HTMLFormElement | null;
  const modeButton = document.getElementById('cloud-auth-mode');
  const submitButton = document.getElementById('cloud-auth-submit') as HTMLButtonElement | null;
  let mode: 'signin' | 'signup' = 'signin';

  modeButton?.addEventListener('click', () => {
    mode = mode === 'signin' ? 'signup' : 'signin';
    if (submitButton) submitButton.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
    if (modeButton) modeButton.textContent = mode === 'signin' ? 'Need an account? Create one' : 'Already registered? Sign in';
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client) return;
    const email = (document.getElementById('cloud-email') as HTMLInputElement | null)?.value.trim() || '';
    const password = (document.getElementById('cloud-password') as HTMLInputElement | null)?.value || '';
    if (!email || password.length < 6) {
      setStatus('error', 'Enter a valid email and password (at least 6 characters).');
      return;
    }
    if (submitButton) submitButton.disabled = true;
    try {
      const result = mode === 'signin'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password });
      if (result.error) { setStatus('error', result.error.message); return; }
      if (mode === 'signup' && !result.data.session) {
        setStatus('signed-out', 'Check your email to confirm your account, then sign in.');
        return;
      }
      hideAccountModal();
      await syncWithCloud();
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : String(error));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.getElementById('cloud-sign-out')?.addEventListener('click', async () => {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) setStatus('error', error.message);
    else { currentUserId = null; currentUserEmail = null; cloudReady = false; setStatus('signed-out'); hideAccountModal(); }
  });
  document.getElementById('cloud-sync-now')?.addEventListener('click', () => { void syncWithCloud(); });
  document.getElementById('cloud-recovery-open')?.addEventListener('click', () => { void showRecoveryHistory(); });
  document.getElementById('farm-backup-export')?.addEventListener('click', exportFarmBackup);
  const importInput = document.getElementById('farm-backup-import') as HTMLInputElement | null;
  importInput?.addEventListener('change', () => {
    const file = importInput.files?.[0] || null;
    void importFarmBackup(file).finally(() => { importInput.value = ''; });
  });

  if (!supabaseUrl || !supabaseKey) {
    setStatus('unconfigured', 'Add Supabase URL and publishable key to enable cloud saves.');
    return;
  }

  client = createClient(supabaseUrl, supabaseKey);
  window.addEventListener('online', () => {
    if (currentUserId) {
      if (cloudSaveQueued && cloudReady) scheduleCloudSave();
      else void syncWithCloud();
    }
  });
  window.addEventListener('offline', () => setStatus('offline'));
  client.auth.onAuthStateChange((_event, session) => {
    currentUserId = session?.user.id || null;
    currentUserEmail = session?.user.email || null;
    if (currentUserId) {
      cloudReady = false;
      window.setTimeout(() => { void syncWithCloud(); }, 0);
    } else {
      cloudReady = false;
      setStatus('signed-out');
    }
  });
  void client.auth.getSession().then(({ data, error }) => {
    if (error) { setStatus('error', error.message); return; }
    currentUserId = data.session?.user.id || null;
    currentUserEmail = data.session?.user.email || null;
    setStatus(currentUserId ? 'synced' : 'signed-out', currentUserId ? `Signed in as ${currentUserEmail || 'your account'} · checking cloud save…` : undefined);
    if (currentUserId) void syncWithCloud();
    else setStatus('signed-out');
  });
}
