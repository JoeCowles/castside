import { icons } from 'lucide-react';

interface IconResolverProps {
  name: string;
  size?: number;
  className?: string;
}

export function IconResolver({ name, size = 24, className }: IconResolverProps) {
  if (!name) return <div style={{ width: size, height: size }} className={className} />;
  
  // Backward compatibility with emojis
  const isEmoji = name.length <= 4 && name.match(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/u);
  if (isEmoji) {
    return <span className={className} style={{ fontSize: size, lineHeight: 1 }}>{name}</span>;
  }

  // Resolve lucide icon
  const IconComponent = (icons as any)[name] || icons.User;
  return <IconComponent size={size} className={className} />;
}
