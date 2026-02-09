import { Inter, JetBrains_Mono } from 'next/font/google';
import './status.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata = {
  title: 'Status Check - Accessibility Dashboard',
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
      {children}
    </div>
  );
}