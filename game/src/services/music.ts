const ENABLED_KEY = 'happyFarmMusicEnabledV1';
const VOLUME_KEY = 'happyFarmMusicVolumeV1';

export function initializeMusicControls(): void {
  const toggle = document.getElementById('music-toggle') as HTMLButtonElement | null;
  const slider = document.getElementById('music-volume') as HTMLInputElement | null;
  const value = document.getElementById('music-volume-value') as HTMLOutputElement | null;
  if (!toggle || !slider || !value) return;

  let enabled = localStorage.getItem(ENABLED_KEY) !== 'false';
  const storedVolume = Number(localStorage.getItem(VOLUME_KEY));
  let volume = Number.isFinite(storedVolume) && localStorage.getItem(VOLUME_KEY) !== null
    ? Math.min(1, Math.max(0, storedVolume))
    : 0.35;

  const audio = new Audio(import.meta.env.BASE_URL + 'audio/FarmVille%20-%20FarmVille%20Theme.mp3');
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = volume;
  let hasStarted = false;

  const render = (): void => {
    toggle.textContent = '♫';
    toggle.setAttribute('aria-label', enabled ? 'Turn background music off' : 'Turn background music on');
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.title = enabled ? 'Turn background music off' : 'Turn background music on';
    slider.value = String(Math.round(volume * 100));
    value.value = Math.round(volume * 100) + '%';
    value.textContent = value.value;
  };

  const startPlayback = (): void => {
    if (!enabled || hasStarted) return;
    hasStarted = true;
    void audio.play().catch(() => { hasStarted = false; });
  };

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    localStorage.setItem(ENABLED_KEY, String(enabled));
    if (enabled) startPlayback();
    else audio.pause();
    render();
  });

  slider.addEventListener('input', () => {
    volume = Math.min(1, Math.max(0, Number(slider.value) / 100));
    audio.volume = volume;
    localStorage.setItem(VOLUME_KEY, String(volume));
    render();
  });

  const unlockAudio = (): void => {
    if (enabled) startPlayback();
  };
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
  render();
}
