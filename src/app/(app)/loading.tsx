// Esqueleto exibido enquanto a página busca os dados (o banco pode acordar devagar).
export default function Carregando() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-label="Carregando">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded bg-line" />
        <div className="h-4 w-40 rounded bg-line/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-lg border border-line bg-card" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => <div key={i} className="h-44 rounded-lg border border-line bg-card" />)}
      </div>
    </div>
  );
}
