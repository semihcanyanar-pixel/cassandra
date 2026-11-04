export function Notice({ title, text, action }) {
  return (
    <div class="app">
      <div class="center">
        <h1>{title}</h1>
        <p class="muted" style="margin:0;font-weight:600;line-height:1.5">{text}</p>
        {action && <button class="btn" onClick={action.run}>{action.label}</button>}
      </div>
    </div>
  );
}
