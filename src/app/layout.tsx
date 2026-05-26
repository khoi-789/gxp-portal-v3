import type { Metadata } from 'next';
import './globals.css';
import Providers from './Providers';

export const metadata: Metadata = {
  title: 'GxP Portal | Hệ thống quản lý chất lượng',
  description:
    'GxP Portal - Nền tảng quản lý quy trình GxP, kiểm soát chất lượng và quản lý danh mục sản phẩm cho ngành Dược.',
  keywords: ['GxP', 'Portal', 'QA', 'Dược', 'Quản lý chất lượng'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
