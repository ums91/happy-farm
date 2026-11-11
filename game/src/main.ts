import Phaser from 'phaser';
import { FarmScene } from './scenes/FarmScene';
import './styles.css';
import { initializeMusicControls } from './services/music';

initializeMusicControls();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1100,
  height: 720,
  transparent: true,
  antialias: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1100,
    height: 720,
  },
  // The farm supports one-finger taps/panning and two-finger pinch zoom.
  // Phaser otherwise enables only one active touch pointer by default.
  input: { activePointers: 3 },
  scene: [FarmScene],
  render: { roundPixels: true, powerPreference: 'high-performance' },
});

window.addEventListener('beforeunload', () => game.destroy(true));
