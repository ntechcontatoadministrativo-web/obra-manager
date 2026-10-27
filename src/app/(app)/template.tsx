// Remontado a cada navegação: dá a entrada suave de cada página.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="pagina-entra">{children}</div>;
}
