import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Props {
  name?: string | null;
  phone: string;
  pictureUrl?: string | null;
  className?: string;
}

function initialsFor(name?: string | null, phone?: string) {
  const src = (name || '').trim();
  if (src) {
    const parts = src.split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || src[0].toUpperCase();
  }
  return phone ? phone.slice(-2) : '?';
}

export default function ContactAvatar({ name, phone, pictureUrl, className }: Props) {
  return (
    <Avatar className={cn('h-9 w-9', className)}>
      {pictureUrl ? <AvatarImage src={pictureUrl} alt={name || phone} /> : null}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {initialsFor(name, phone)}
      </AvatarFallback>
    </Avatar>
  );
}
