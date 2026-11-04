import { render } from 'preact';
import './theme.css';
import './stage2.css';
import { App } from './App.jsx';

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
