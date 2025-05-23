import './globals.css'

export const metadata = {
  title: 'WTF Podcast AI',
  description: 'Ask Nikhil anything - Get insights from podcast episodes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}