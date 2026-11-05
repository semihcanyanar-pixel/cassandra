import { render } from 'preact';
import './theme.css';
import './stage2.css';
import './stage3.css';
import './stage4.css';
import './stage5.css';
import './stage6.css';
import './stage7.css';
import { App } from './App.jsx';

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
