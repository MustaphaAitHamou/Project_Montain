export default function Loading() {
  return (
    <main className="page container" id="contenu" aria-busy="true">
      <div className="row" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="muted">Chargement…</span>
      </div>
    </main>
  );
}
