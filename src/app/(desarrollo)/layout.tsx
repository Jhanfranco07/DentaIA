export default function DesarrolloLayout({ children }: { children: React.ReactNode }) {
  return <main id="contenido" tabIndex={-1} className="module-shell">{children}</main>;
}
