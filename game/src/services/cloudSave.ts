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

function localSnapshot(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch {
    return null;
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

    if (
      remote?.save_data &&
      !preserveLegacyLocal &&
      !dirtyAtRead &&
      !latestLocalIsDirty &&
      !localChangedDuringFetch &&
      remoteUpdatedAt > localUpdatedAt
    ) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(remote.save_data));
      localStorage.setItem(LOCAL_UPDATED_KEY, String(remoteUpdatedAt));
      setStatus('synced', 'Cloud farm restored · refreshing game…');
      window.location.reload();
      return;
    }

    // Upload the latest snapshot. Keep it marked dirty until the server confirms
    // the exact updated_at value, so clock skew cannot make an older cloud copy win
    // on the next page load.
    const latestLocal = localSnapshot();
    if (latestLocal) {
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
