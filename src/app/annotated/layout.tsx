import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Annotated — The web, marked up',
  description:
    'Highlight a YouTube clip. Scribble in a margin. Send an essay to a friend with your thinking already attached. Annotated is a quiet social network for people who read like it matters.',
};

export default function AnnotatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
