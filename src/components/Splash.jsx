// Loading screen: same markup/styles as the static splash in index.html, so there is no visual jump when the app boots.
export const Splash = () => (
  <div class="splash" role="status" aria-label="Yükleniyor">
    <img src="./icon-192.png" alt="" width="96" height="96" />
  </div>
);
