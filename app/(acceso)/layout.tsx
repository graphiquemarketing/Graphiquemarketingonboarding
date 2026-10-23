export default function Layout({ children }: { children: React.ReactNode }) {
  return <main id="contenido" tabIndex={-1} style={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</main>;
}
