import { Inter, JetBrains_Mono } from 'next/font/google';
import '../status/status.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata = {
  title: 'Team Progress - Accessibility Dashboard',
};

export default function TeamProgressLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
      {children}
    </div>
  );
}
