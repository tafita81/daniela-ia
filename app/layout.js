export const metadata = { title: 'Daniela IA', description: 'Assistente IA avançada' };
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
      <body style={{margin:0,padding:0,background:'#0f0f0f'}}>{children}</body>
    </html>
  );
}
